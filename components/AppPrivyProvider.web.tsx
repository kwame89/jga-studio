import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

export default function AppPrivyProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.EXPO_PUBLIC_PRIVY_APP_ID!}
      clientId={process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID}
      config={{
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
