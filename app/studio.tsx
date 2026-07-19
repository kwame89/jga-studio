// Studio admin surface: artwork inventory, pricing, publishing, and collection
// visibility.
//
// This lived inline on the Profile screen, which meant every signed-in
// collector mounted the ~800-line StudioCatalogManager and fired an
// admin-catalog request that could only ever be rejected. Profile is the
// collector's own account; running the studio is a different job and belongs on
// its own route.
//
// Reached from an admin-only row on Profile. The guard here is what actually
// protects the screen — the Profile row only decides whether to advertise it —
// and the real enforcement is server-side in admin-catalog, which verifies the
// Privy token against studio_admins on every call.
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StudioCatalogManager from '../components/StudioCatalogManager';
import { usePrivy } from '../lib/privy';
import { useGoBack } from '../lib/useGoBack';
import { useTheme } from '../themeContext';

export default function StudioScreen() {
  const goBack = useGoBack('/(tabs)/profile');
  const theme = useTheme();
  const styles = createStyles(theme);
  const { user, isReady, getAccessToken } = usePrivy();
  const isSignedIn = !!user;

  // StudioCatalogManager already probes admin-catalog and reports back, so the
  // screen reuses that rather than running a second identical request.
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Studio</Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.intro}>
        <Text style={styles.eyebrow}>Private studio controls</Text>
        <Text style={styles.introTitle}>Artwork inventory</Text>
        <Text style={styles.introText}>
          Set prices, publish work to the catalog, and control which collections
          are visible in Discover.
        </Text>
      </View>

      {!isReady ? (
        <View style={styles.state}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : !isSignedIn ? (
        <View style={styles.state}>
          <Ionicons name="lock-closed-outline" size={26} color={theme.accent} />
          <Text style={styles.stateTitle}>Sign in required</Text>
          <Text style={styles.stateText}>
            Sign in from your Profile to manage the studio catalog.
          </Text>
        </View>
      ) : (
        <>
          <StudioCatalogManager
            getAccessToken={getAccessToken}
            onAuthorizationChange={(authorized) => setIsAuthorized(authorized)}
          />

          {/* StudioCatalogManager renders nothing when the caller is not an
              admin, which would leave a blank screen. Say so plainly instead. */}
          {isAuthorized === false ? (
            <View style={styles.state}>
              <Ionicons
                name="shield-outline"
                size={26}
                color={theme.accent}
              />
              <Text style={styles.stateTitle}>Studio access only</Text>
              <Text style={styles.stateText}>
                This account cannot manage the studio catalog.
              </Text>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    contentContainer: {
      paddingBottom: 96,
    },
    header: {
      paddingTop: Platform.OS === 'ios' ? 62 : 28,
      paddingHorizontal: 18,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '700',
    },
    headerSpacer: {
      width: 42,
    },
    intro: {
      marginTop: 10,
      marginHorizontal: 18,
      marginBottom: 6,
    },
    eyebrow: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    introTitle: {
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: 28,
      lineHeight: 34,
    },
    introText: {
      color: theme.text,
      opacity: 0.7,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 10,
    },
    state: {
      minHeight: 200,
      marginHorizontal: 18,
      marginTop: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 20,
    },
    stateTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    stateText: {
      maxWidth: 320,
      color: theme.text,
      opacity: 0.65,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
    },
  });
