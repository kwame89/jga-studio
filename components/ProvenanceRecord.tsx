import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../themeContext';

export type ProvenanceEvent = {
  id: string;
  type: string;
  label: string;
  occurred_at: string;
  actor_name: string | null;
  from_party_name: string | null;
  to_party_name: string | null;
  price: number | null;
  currency: string | null;
  notes: string | null;
  exhibition_title: string | null;
  exhibition_venue: string | null;
  exhibition_location: string | null;
  exhibition_end_date: string | null;
  condition_rating: string | null;
  proof_kind: 'signed' | 'corroborated' | 'anchored' | 'recorded';
  proof_label: string;
  anchor_hash: string | null;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatMoney(value: number, currency: string | null) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || 'USD'} ${value.toLocaleString()}`;
  }
}

function eventNarrative(event: ProvenanceEvent) {
  if (event.type === 'genesis') {
    return event.to_party_name
      ? `Entered the artist's archive with ${event.to_party_name} recorded as owner and custodian.`
      : 'Entered the artist-maintained archive.';
  }
  if (event.type === 'ownership_transfer') {
    const parties =
      event.from_party_name && event.to_party_name
        ? `${event.from_party_name} to ${event.to_party_name}`
        : 'Ownership transfer recorded';
    const price =
      event.price !== null ? ` · ${formatMoney(event.price, event.currency)}` : '';
    return `${parties}${price}`;
  }
  if (event.type === 'custody_change') {
    return event.from_party_name && event.to_party_name
      ? `${event.from_party_name} to ${event.to_party_name}`
      : 'A custody change was recorded.';
  }
  if (event.type === 'exhibition') {
    return [
      event.exhibition_title,
      event.exhibition_venue,
      event.exhibition_location,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (event.type === 'condition_report' && event.condition_rating) {
    return `Condition recorded as ${event.condition_rating}.`;
  }
  return event.actor_name ? `Recorded by ${event.actor_name}.` : 'Recorded in Archive Atlas.';
}

export function ProvenanceRecord({ events }: { events: ProvenanceEvent[] | null | undefined }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const safeEvents = Array.isArray(events) ? events : [];

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>Archive Atlas record</Text>
      <Text style={styles.title}>Provenance</Text>
      <Text style={styles.intro}>
        Artist-maintained history synchronized with this artwork.
      </Text>

      {safeEvents.length === 0 ? (
        <Text style={styles.empty}>No provenance events have been published yet.</Text>
      ) : (
        <View style={styles.timeline}>
          {safeEvents.map((event, index) => {
            const narrative = eventNarrative(event);
            return (
              <View key={event.id} style={styles.event}>
                <View style={styles.rail}>
                  <View style={styles.marker} />
                  {index < safeEvents.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={styles.eventBody}>
                  <View style={styles.eventHeading}>
                    <View style={styles.eventHeadingCopy}>
                      <Text style={styles.date}>{formatDate(event.occurred_at)}</Text>
                      <Text style={styles.eventTitle}>{event.label}</Text>
                    </View>
                    <View style={styles.proofBadge}>
                      <Text style={styles.proofText}>{event.proof_label}</Text>
                    </View>
                  </View>
                  {narrative ? <Text style={styles.narrative}>{narrative}</Text> : null}
                  {event.actor_name ? (
                    <Text style={styles.actor}>Recorded by {event.actor_name}</Text>
                  ) : null}
                  {event.notes ? <Text style={styles.notes}>{event.notes}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    section: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 30,
      paddingBottom: 10,
    },
    eyebrow: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    title: {
      color: theme.text,
      fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
      fontSize: 30,
      lineHeight: 36,
    },
    intro: {
      maxWidth: 620,
      color: theme.text,
      opacity: 0.62,
      fontSize: 14,
      lineHeight: 22,
      marginTop: 8,
    },
    empty: {
      color: theme.text,
      opacity: 0.58,
      fontSize: 14,
      lineHeight: 22,
      marginTop: 24,
    },
    timeline: {
      marginTop: 28,
    },
    event: {
      flexDirection: 'row',
      minWidth: 0,
    },
    rail: {
      width: 22,
      alignItems: 'center',
    },
    marker: {
      width: 9,
      height: 9,
      borderRadius: 5,
      marginTop: 7,
      backgroundColor: theme.accent,
    },
    line: {
      width: 1,
      flex: 1,
      minHeight: 76,
      marginTop: 5,
      backgroundColor: theme.border,
    },
    eventBody: {
      minWidth: 0,
      flex: 1,
      paddingLeft: 12,
      paddingBottom: 30,
    },
    eventHeading: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    eventHeadingCopy: {
      minWidth: 0,
      flex: 1,
    },
    date: {
      color: theme.text,
      opacity: 0.54,
      fontSize: 11,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    eventTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 22,
    },
    proofBadge: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    proofText: {
      color: theme.accent,
      fontSize: 10,
      fontWeight: '700',
    },
    narrative: {
      color: theme.text,
      opacity: 0.78,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 9,
    },
    actor: {
      color: theme.text,
      opacity: 0.5,
      fontSize: 12,
      marginTop: 5,
    },
    notes: {
      color: theme.text,
      opacity: 0.66,
      fontSize: 13,
      fontStyle: 'italic',
      lineHeight: 20,
      marginTop: 8,
    },
  });
