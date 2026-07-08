import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../themeContext';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: 'release' | 'auction' | 'account';
  time: string;
};

const mockNotifications: NotificationItem[] = [
  {
    id: '1',
    title: 'New studio release',
    message: 'A new featured artwork has been added to the collection.',
    type: 'release',
    time: 'Today',
  },
  {
    id: '2',
    title: 'Auction reminder',
    message: 'Live and upcoming auctions will appear here as activity grows.',
    type: 'auction',
    time: 'This week',
  },
  {
    id: '3',
    title: 'Collector account updates',
    message: 'Profile, rewards, and wallet-related updates will appear here.',
    type: 'account',
    time: 'Recent',
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = createStyles(theme);

  const getIconName = (type: NotificationItem['type']) => {
    switch (type) {
      case 'release':
        return 'sparkles-outline';
      case 'auction':
        return 'hammer-outline';
      case 'account':
      default:
        return 'person-circle-outline';
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Notifications</Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>JGA Studio</Text>
        <Text style={styles.heroTitle}>Collector Updates</Text>
        <Text style={styles.heroText}>
          Important activity, new releases, and future auction reminders will appear here.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent</Text>

        {mockNotifications.map((item) => (
          <View key={item.id} style={styles.notificationCard}>
            <View style={styles.iconWrap}>
              <Ionicons name={getIconName(item.type)} size={22} color={theme.accent} />
            </View>

            <View style={styles.notificationBody}>
              <View style={styles.notificationTopRow}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                <Text style={styles.notificationTime}>{item.time}</Text>
              </View>

              <Text style={styles.notificationMessage}>{item.message}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coming Soon</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Future notification types</Text>
          <Text style={styles.infoText}>• Wishlist updates</Text>
          <Text style={styles.infoText}>• Auction ending reminders</Text>
          <Text style={styles.infoText}>• New featured releases</Text>
          <Text style={styles.infoText}>• Collector reward announcements</Text>
        </View>
      </View>
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
      paddingBottom: 40,
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
    heroCard: {
      marginTop: 10,
      marginHorizontal: 18,
      padding: 18,
      borderRadius: 22,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    heroEyebrow: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    heroTitle: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 8,
    },
    heroText: {
      color: theme.text,
      opacity: 0.75,
      lineHeight: 22,
      fontSize: 15,
    },
    section: {
      marginTop: 28,
      paddingHorizontal: 18,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 12,
    },
    notificationCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.isDark ? '#2A2236' : '#F1EAFE',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    notificationBody: {
      flex: 1,
    },
    notificationTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 6,
      gap: 10,
    },
    notificationTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
      flex: 1,
    },
    notificationTime: {
      color: theme.text,
      opacity: 0.5,
      fontSize: 12,
      marginTop: 2,
    },
    notificationMessage: {
      color: theme.text,
      opacity: 0.75,
      fontSize: 14,
      lineHeight: 20,
    },
    infoCard: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      padding: 16,
    },
    infoTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 10,
    },
    infoText: {
      color: theme.text,
      opacity: 0.75,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 4,
    },
  });