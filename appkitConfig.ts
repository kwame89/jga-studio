// appkitConfig.ts
import "@walletconnect/react-native-compat";
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createAppKit } from '@reown/appkit-react-native';
import { EthersAdapter } from '@reown/appkit-ethers-react-native';

const projectId = 'ebdd24e1dcc487807d76fd8c485d22f6';

export const appKit = createAppKit({
  projectId,
  adapter: new EthersAdapter(),
  storage: AsyncStorage,           // This fixes the "Storage is not set" error
  networks: [], 
  features: {
    email: false,
    socials: false,
  },
  themeMode: 'light',
});