import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = {
  isDark: boolean;
  background: string;
  card: string;
  text: string;
  accent: string;
  border: string;
  toggleDarkMode: () => void;
};

const ThemeContext = createContext<Theme | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');

  // Load saved preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem('theme');
        if (saved !== null) {
          setIsDark(saved === 'dark');
        }
      } catch (e) {
        console.error('Error loading theme:', e);
      }
    };
    loadTheme();
  }, []);

  const toggleDarkMode = async () => {
    const newMode = !isDark;
    setIsDark(newMode);
    try {
      await AsyncStorage.setItem('theme', newMode ? 'dark' : 'light');
    } catch (e) {
      console.error('Error saving theme:', e);
    }
  };

  const theme: Theme = {
    isDark,
    background: isDark ? '#09090A' : '#F4F3F0',
    card: isDark ? '#151416' : '#FFFFFF',
    text: isDark ? '#F7F5F8' : '#18161B',
    accent: isDark ? '#B264FF' : '#7138A8',
    border: isDark ? '#302D33' : '#D7D3DA',
    toggleDarkMode,
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
