import 'fast-text-encoding';
import 'react-native-get-random-values';

import React from 'react';
import { Stack } from 'expo-router';
import { StripeProvider } from '@stripe/stripe-react-native';
import { PrivyProvider } from '@privy-io/expo';
import { ThemeProvider } from '../themeContext';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <PrivyProvider
      appId={process.env.EXPO_PUBLIC_PRIVY_APP_ID!}
      clientId={process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID!}
      config={{
        embeddedWallets: {
          createOnLogin: 'off',
        },
      }}
    >
      <StripeProvider
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
        merchantIdentifier="merchant.com.jgastudio"
      >
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="artwork/[id]" />
          </Stack>
        </ThemeProvider>
      </StripeProvider>
    </PrivyProvider>
  );
}