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
    background: isDark ? '#121212' : '#F8F5F0',
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#3C2A5E',
    accent: '#6B4E9E', // Royal purple stays the same in both modes
    border: isDark ? '#333' : '#ddd',
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