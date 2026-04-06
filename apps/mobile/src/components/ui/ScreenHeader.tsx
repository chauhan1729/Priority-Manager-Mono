import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: {
    label: string;
    onPress: () => void;
  };
}

export function ScreenHeader({ title, onBack, rightAction }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={8}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>
        {rightAction ? (
          <TouchableOpacity onPress={rightAction.onPress} hitSlop={8}>
            <Text style={styles.rightActionLabel}>{rightAction.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    minHeight: 56,
  },
  left: {
    width: 40,
    alignItems: 'flex-start',
  },
  right: {
    width: 60,
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.ink.DEFAULT,
  },
  backButton: {
    padding: 2,
  },
  backIcon: {
    fontSize: 28,
    color: colors.blue[600],
    lineHeight: 30,
  },
  rightActionLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.blue[600],
  },
});
