import 'fast-text-encoding';
import 'react-native-get-random-values';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider } from '../themeContext';
import AppPrivyProvider from '../components/AppPrivyProvider';
import PaymentProvider from '../components/PaymentProvider';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { View, ActivityIndicator, Platform, StyleSheet, Text } from 'react-native';

type StartupBoundaryState = {
  error: Error | null;
};

class StartupBoundary extends Component<
  { children: ReactNode },
  StartupBoundaryState
> {
  state: StartupBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StartupBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('JGA Studio startup error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.errorPage}>
        <Text style={styles.errorTitle}>JGA Studio could not start</Text>
        <Text style={styles.errorMessage}>
          Refresh the page. If this continues, share this message with support:
        </Text>
        <Text selectable style={styles.errorDetail}>
          {this.state.error.message}
        </Text>
      </View>
    );
  }
}

function AppProviders() {
  return (
    <AppPrivyProvider>
      <PaymentProvider>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="artwork/[id]" />
          </Stack>
        </ThemeProvider>
      </PaymentProvider>
    </AppPrivyProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (Platform.OS !== 'web' && !fontsLoaded && !fontError) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator color="#c9985a" />
      </View>
    );
  }

  return (
    <StartupBoundary>
      <AppProviders />
    </StartupBoundary>
  );
}

const styles = StyleSheet.create({
  loadingPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b0b0b',
  },
  errorPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f3ed',
    padding: 32,
  },
  errorTitle: {
    color: '#17140f',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    color: '#5f5a52',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 560,
    textAlign: 'center',
  },
  errorDetail: {
    color: '#8a2d2d',
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 16,
    maxWidth: 680,
    textAlign: 'center',
  },
});
