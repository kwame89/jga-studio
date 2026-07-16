import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, useWindowDimensions } from 'react-native';
import { useTheme } from '../../themeContext';

export default function TabLayout() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const desktopWeb = Platform.OS === 'web' && width >= 960;
  const tabBarBackground = desktopWeb
    ? '#09080A'
    : theme.isDark
      ? '#0A090B'
      : '#FFFFFF';
  const inactiveColor = desktopWeb
    ? '#B7B1BB'
    : theme.isDark
      ? '#8B878F'
      : '#77727C';

  return (
    <Tabs
      screenOptions={{
        tabBarPosition: desktopWeb ? 'top' : 'bottom',
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: inactiveColor,
        tabBarActiveBackgroundColor: desktopWeb ? '#171419' : 'transparent',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: desktopWeb ? 13 : 11,
          fontWeight: desktopWeb ? '700' : '600',
          marginTop: desktopWeb ? 0 : 1,
          marginBottom: desktopWeb ? 0 : Platform.OS === 'ios' ? 0 : 7,
        },
        tabBarItemStyle: {
          maxWidth: desktopWeb ? 170 : undefined,
          paddingTop: desktopWeb ? 0 : 7,
        },
        tabBarStyle: {
          height: desktopWeb ? 58 : Platform.OS === 'ios' ? 82 : 66,
          backgroundColor: tabBarBackground,
          borderTopWidth: desktopWeb ? 0 : 1,
          borderTopColor: desktopWeb ? 'transparent' : theme.border,
          borderBottomWidth: desktopWeb ? 1 : 0,
          borderBottomColor: desktopWeb ? '#2D2631' : 'transparent',
          justifyContent: desktopWeb ? 'flex-end' : undefined,
          elevation: 0,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) =>
            desktopWeb ? null : (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={22}
                color={color}
              />
            ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, focused }) =>
            desktopWeb ? null : (
              <Ionicons
                name={focused ? 'compass' : 'compass-outline'}
                size={22}
                color={color}
              />
            ),
        }}
      />
      <Tabs.Screen
        name="auctions"
        options={{
          title: 'Auctions',
          tabBarIcon: ({ color, focused }) =>
            desktopWeb ? null : (
              <Ionicons
                name={focused ? 'hammer' : 'hammer-outline'}
                size={22}
                color={color}
              />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) =>
            desktopWeb ? null : (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={22}
                color={color}
              />
            ),
        }}
      />
    </Tabs>
  );
}
