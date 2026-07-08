import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../themeContext';

export default function ModalScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Modal</Text>
      <Text style={styles.text}>This screen is ready for future use.</Text>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    title: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 8,
    },
    text: {
      color: theme.text,
      opacity: 0.7,
      fontSize: 16,
      textAlign: 'center',
    },
  });