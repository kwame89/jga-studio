import { PrivyProvider } from '@privy-io/expo';

export const privyConfig = {
  appId: 'cmgs6y5lt00nijr0bvlenep9d', // ← Your Privy App ID
  loginMethods: ['email', 'wallet', 'apple', 'google'],
  appearance: {
    theme: 'light' as const,
    accentColor: '#6B4E9E',
  },
};