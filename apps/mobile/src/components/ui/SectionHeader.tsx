import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';

interface SectionHeaderProps {
  title: string;
  count?: number;
}

export function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.rule} />
      <Text style={styles.title}>{title}</Text>
      {count !== undefined ? (
        <View style={styles.countPill}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rule: {
    height: 1,
    backgroundColor: colors.blue[100],
    width: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.ink.DEFAULT,
  },
  countPill: {
    backgroundColor: colors.blue[100],
    borderRadius: 99,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  countText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.blue[700],
  },
});
