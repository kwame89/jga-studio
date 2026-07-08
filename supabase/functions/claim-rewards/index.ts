import { createClient } from 'npm:@supabase/supabase-js@2'
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
] as const

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const email =
      user.email ||
      user.identities?.find((i: any) => i.identity_data?.email)?.identity_data?.email

    const { data: collectorWallet } = await supabase
      .from('collector_wallets')
      .select('wallet_address')
      .eq('privy_user_id', user.id)
      .maybeSingle()

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

    const treasuryKey = Deno.env.get('TREASURY_PRIVATE_KEY')!
    const tokenAddress = Deno.env.get('JGA_TOKEN_ADDRESS')! as `0x${string}`
    const rpcUrl = Deno.env.get('BASE_RPC_URL')!

    const account = privateKeyToAccount(treasuryKey as `0x${string}`)

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
