import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Contact, ContactCategory } from '@pm/types';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Category badge config
// ---------------------------------------------------------------------------

const CATEGORY_STYLE: Record<ContactCategory, { bg: string; text: string; label: string }> = {
  personal:     { bg: colors.purple[100], text: colors.purple[700], label: 'Personal' },
  professional: { bg: colors.blue[100],   text: colors.blue[700],   label: 'Professional' },
  family:       { bg: colors.green[100],  text: colors.green[700],  label: 'Family' },
  client:       { bg: colors.amber[100],  text: colors.amber[700],  label: 'Client' },
  vendor:       { bg: colors.gray[100],   text: colors.gray[600],   label: 'Vendor' },
  other:        { bg: colors.gray[100],   text: colors.gray[600],   label: 'Other' },
};

interface Props {
  contact: Contact;
  onPress: () => void;
  onLongPress?: () => void;
}

function ContactCardBase({ contact, onPress, onLongPress }: Props) {
  const cat = CATEGORY_STYLE[contact.category] ?? CATEGORY_STYLE.other;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onLongPress?.(); }}
      activeOpacity={0.75}
    >
      {/* Avatar circle */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {contact.full_name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {contact.full_name}
          </Text>
          <View style={[styles.badge, { backgroundColor: cat.bg }]}>
            <Text style={[styles.badgeText, { color: cat.text }]}>{cat.label}</Text>
          </View>
        </View>

        {(contact.company || contact.role) && (
          <Text style={styles.sub} numberOfLines={1}>
            {[contact.role, contact.company].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export const ContactCard = React.memo(ContactCardBase);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[100],
    padding: spacing.md,
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.blue[100],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.blue[700],
  },
  body: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.ink.DEFAULT,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
  },
  sub: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
  },
  chevron: {
    fontFamily: fontFamily.sans,
    fontSize: 20,
    color: colors.gray[300],
    flexShrink: 0,
  },
});
