import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

export default function AppPrivyProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.EXPO_PUBLIC_PRIVY_APP_ID!}
      config={{
        // Scope web login to email only. The Privy app has other login
        // methods enabled (e.g. Solana) whose connectors aren't wired up on
        // web; without this, Privy stalls initialization and the email login
        // button silently does nothing. Email is how collectors sign in;
        // the embedded EVM wallet is created after login.
        loginMethods: ['email'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'off',
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
