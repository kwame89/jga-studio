import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyPrivyUser } from '../_shared/privyAuth.ts'
import { createWalletClient, createPublicClient, http, parseUnits } from 'npm:viem'
import { privateKeyToAccount } from 'npm:viem/accounts'
import { base } from 'npm:viem/chains'

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

/**
 * Collector-facing error. Keep the message vague about internals — a claimant
 * should never learn which secret is unset or which wallet is empty — and put
 * the actionable detail in console.error for the studio's logs.
 */
function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Collectors authenticate with PRIVY, not Supabase Auth. This function
    // predates that realignment and still called supabase.auth.getUser() on
    // whatever token arrived — which, with no Supabase session in the app, was
    // the anon key. That always failed, so every claim 401'd before it ever
    // looked at a reward. create-order, get-order and the crypto-payment
    // functions were migrated to _shared/privyAuth; this one was missed.
    const privyUserId = await verifyPrivyUser(req)
    if (!privyUserId) {
      return jsonError('Sign in required', 401)
    }

    // privy_user_id stores the DID (did:privy:...), which is exactly the JWT
    // `sub` verifyPrivyUser returns. The old code compared it against a
    // Supabase user UUID, which could never have matched even if auth had
    // worked.
    const { data: collectorWallet } = await supabase
      .from('collector_wallets')
      .select('wallet_address, email')
      .eq('privy_user_id', privyUserId)
      .maybeSingle()

    const email = collectorWallet?.email ?? null

    if (!collectorWallet?.wallet_address) {
      return new Response(JSON.stringify({ error: 'No collector wallet found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let rewardsQuery = supabase
      .from('reward_events')
      .select('*')
      .eq('status', 'claimable')

    if (collectorWallet.wallet_address) {
      rewardsQuery = rewardsQuery.eq('buyer_wallet', collectorWallet.wallet_address)
    } else if (email) {
      rewardsQuery = rewardsQuery.eq('buyer_email', email)
    }

    const { data: rewardRows, error: rewardsError } = await rewardsQuery

    if (rewardsError) {
      throw rewardsError
    }

    const total = (rewardRows || []).reduce(
      (sum, row) => sum + Number(row.reward_amount || 0),
      0
    )

    if (!total || total <= 0) {
      return new Response(JSON.stringify({ success: true, claimed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // --- payout caps ---------------------------------------------------------
    // The signer is a hot wallet reachable through a public HTTP endpoint, so
    // a bug or an abusive caller could otherwise drain the whole float in a
    // loop. These bound the damage: a single claim is limited, and total
    // payouts across all collectors are limited over a rolling 24h.
    //
    // Both are env-tunable so the ceiling can be raised without a deploy.
    // Defaults assume the current 500k float — the daily cap is deliberately
    // well under it, so draining takes days rather than seconds and there is
    // time to notice.
    //
    // NOTE: this is a check-then-act, so two simultaneous claims could each
    // pass and jointly exceed the daily cap. Closing that properly needs a DB
    // constraint or an advisory lock around the claim. At these volumes the
    // window is not worth the complexity, but it is a real gap, not an
    // oversight.
    const maxPerClaim = Number(Deno.env.get('REWARDS_MAX_PER_CLAIM') ?? 50_000)
    const maxPerDay = Number(Deno.env.get('REWARDS_MAX_PER_DAY') ?? 150_000)

    if (total > maxPerClaim) {
      console.warn(
        `claim-rewards: claim of ${total} exceeds per-claim cap ${maxPerClaim}`
      )
      return jsonError(
        `Claims are limited to ${maxPerClaim.toLocaleString()} $JGA at a time. ` +
          `Please contact the studio to release a larger balance.`,
        429
      )
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentClaims, error: recentError } = await supabase
      .from('reward_events')
      .select('reward_amount')
      .eq('status', 'claimed')
      .gte('claimed_at', since)

    if (recentError) throw recentError

    const paidLast24h = (recentClaims || []).reduce(
      (sum, row) => sum + Number(row.reward_amount || 0),
      0
    )

    if (paidLast24h + total > maxPerDay) {
      console.error(
        `claim-rewards: daily cap reached — ${paidLast24h} paid in 24h, ` +
          `claim of ${total} would exceed ${maxPerDay}`
      )
      return jsonError(
        'The daily reward limit has been reached. Please try again tomorrow.',
        429
      )
    }

    // The signer is a dedicated hot wallet holding a working float — NOT the
    // studio treasury, which is a passkey-controlled Base App account with no
    // exportable key. REWARDS_SIGNER_PRIVATE_KEY is the accurate name;
    // TREASURY_PRIVATE_KEY is the original one and stays as a fallback so
    // deploying this does not require rotating the secret first.
    const signerKey =
      Deno.env.get('REWARDS_SIGNER_PRIVATE_KEY') ??
      Deno.env.get('TREASURY_PRIVATE_KEY')
    const tokenAddress = Deno.env.get('JGA_TOKEN_ADDRESS') as
      | `0x${string}`
      | undefined
    const rpcUrl = Deno.env.get('BASE_RPC_URL')

    // These were non-null assertions (`!`), which type-check but are a lie at
    // runtime: a missing secret produced an opaque crash deep inside viem
    // rather than saying what was unconfigured. That is why this function sat
    // broken from April to July without anyone noticing.
    if (!signerKey) {
      console.error('claim-rewards: no rewards signer key configured')
      return jsonError(
        'Reward claims are temporarily unavailable. The studio has been notified.',
        503
      )
    }
    if (!tokenAddress) {
      console.error('claim-rewards: JGA_TOKEN_ADDRESS is not set')
      return jsonError(
        'Reward claims are temporarily unavailable. The studio has been notified.',
        503
      )
    }

    let account
    try {
      account = privateKeyToAccount(
        (signerKey.startsWith('0x') ? signerKey : `0x${signerKey}`) as `0x${string}`
      )
    } catch {
      // Never echo the underlying error — viem includes key material in it.
      console.error('claim-rewards: rewards signer key is malformed')
      return jsonError(
        'Reward claims are temporarily unavailable. The studio has been notified.',
        503
      )
    }

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(rpcUrl),
    })

    const publicClient = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    })

    const amount = parseUnits(total.toString(), 18)

    // Pre-flight the signer's balances. Without this an unfunded or
    // underfunded signer fails as an opaque revert (or, with no ETH, as a gas
    // estimation error) after the collector has already tapped Claim.
    const [signerJga, signerEth] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      }) as Promise<bigint>,
      publicClient.getBalance({ address: account.address }),
    ])

    if (signerEth === 0n) {
      console.error(
        `claim-rewards: signer ${account.address} has no ETH for gas`
      )
      return jsonError(
        'Reward claims are paused while the studio tops up the rewards wallet.',
        503
      )
    }
    if (signerJga < amount) {
      console.error(
        `claim-rewards: signer ${account.address} float too low — ` +
          `has ${signerJga}, needs ${amount}`
      )
      return jsonError(
        'Reward claims are paused while the studio tops up the rewards wallet.',
        503
      )
    }

    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [collectorWallet.wallet_address as `0x${string}`, amount],
    })

    await publicClient.waitForTransactionReceipt({ hash })

    const rewardIds = (rewardRows || []).map((row) => row.id)

    await supabase
      .from('reward_events')
      .update({
        status: 'claimed',
        claimed_at: new Date().toISOString(),
        treasury_tx_hash: hash,
      })
      .in('id', rewardIds)

    return new Response(JSON.stringify({ success: true, hash, claimed: total }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Claim failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
