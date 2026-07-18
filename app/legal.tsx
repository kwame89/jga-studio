// Profile → Legal. Two documents (Terms, Privacy) behind a tab switch, so a
// collector reaches either in one tap rather than through a submenu.
//
// All copy lives in constants/legalContent.ts — this file is layout only, so
// the text can be revised without touching the screen.
import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  LAST_UPDATED,
  LEGAL_DOCUMENTS,
  type LegalDocument,
} from '../constants/legalContent';
import { useGoBack } from '../lib/useGoBack';
import { useTheme } from '../themeContext';

export default function LegalScreen() {
  const goBack = useGoBack('/(tabs)/profile');
  const theme = useTheme();
  const styles = createStyles(theme);
  const [activeKey, setActiveKey] = useState<LegalDocument['key']>('terms');

  const active =
    LEGAL_DOCUMENTS.find((doc) => doc.key === activeKey) ?? LEGAL_DOCUMENTS[0];

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

        <Text style={styles.headerTitle}>Legal</Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        {LEGAL_DOCUMENTS.map((doc) => {
          const isActive = doc.key === active.key;
          return (
            <TouchableOpacity
              key={doc.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveKey(doc.key)}
              activeOpacity={0.85}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {doc.tabLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.body}>
        <Text style={styles.docTitle}>{active.title}</Text>
        <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>
        <Text style={styles.intro}>{active.intro}</Text>

        {active.sections.map((section, index) => (
          <View key={`${active.key}-${index}`} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            {section.paragraphs.map((paragraph, i) => (
              <Text key={i} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
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
    tabs: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
      marginHorizontal: 18,
    },
    tab: {
      flex: 1,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 6,
    },
    tabActive: {
      backgroundColor: theme.text,
      borderColor: theme.text,
    },
    tabText: {
      color: theme.text,
      opacity: 0.7,
      fontSize: 13,
      fontWeight: '700',
    },
    tabTextActive: {
      color: theme.background,
      opacity: 1,
    },
    body: {
      marginTop: 22,
      marginHorizontal: 18,
    },
    docTitle: {
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: 28,
      lineHeight: 34,
    },
    updated: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      marginTop: 8,
    },
    intro: {
      color: theme.text,
      opacity: 0.72,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 14,
    },
    section: {
      marginTop: 26,
    },
    sectionHeading: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 8,
    },
    paragraph: {
      color: theme.text,
      opacity: 0.72,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 10,
    },
  });
