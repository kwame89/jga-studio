import { useMemo } from 'react';
import {
  useCreateWallet as useWebCreateWallet,
  useLoginWithEmail as useWebLoginWithEmail,
  usePrivy as useWebPrivy,
  useWallets,
} from '@privy-io/react-auth';

export function usePrivy() {
  const privy = useWebPrivy();
  const user = useMemo(() => {
    if (!privy.user) return null;

    return {
      ...privy.user,
      linked_accounts: privy.user.linkedAccounts,
    };
  }, [privy.user]);

  return {
    user,
    isReady: privy.ready,
    error: privy.error,
    logout: privy.logout,
    getAccessToken: privy.getAccessToken,
  };
}

export function useLoginWithEmail() {
  const emailLogin = useWebLoginWithEmail();

  return {
    ...emailLogin,
    loginWithCode: ({ code }: { code: string; email?: string }) =>
      emailLogin.loginWithCode({ code }),
  };
}

export function useEmbeddedEthereumWallet() {
  const { wallets, ready } = useWallets();
  const embeddedWallets = useMemo(
    () =>
      wallets
        .filter((wallet) => wallet.walletClientType === 'privy')
        .map((wallet) => ({
          address: wallet.address,
          walletClientType: wallet.walletClientType,
          getProvider: () => wallet.getEthereumProvider(),
        })),
    [wallets]
  );

  return {
    ready,
    wallets: embeddedWallets,
  };
}

export function useCreateWallet() {
  const { createWallet } = useWebCreateWallet();

  return {
    createWallet: async (_input?: { chainType?: string }) => {
      const wallet = await createWallet();
      return { wallet };
    },
  };
}
