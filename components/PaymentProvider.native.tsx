import React, { type ReactElement } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';

export default function PaymentProvider({ children }: { children: ReactElement }) {
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
      merchantIdentifier="merchant.com.jgastudio"
    >
      {children}
    </StripeProvider>
  );
}
