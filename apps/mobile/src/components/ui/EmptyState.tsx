import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';
import { Button } from './Button';

interface EmptyStateProps {
  message: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="secondary"
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.blue[100],
    borderStyle: 'dashed',
    borderRadius: borderRadius.xl,
    padding: spacing['3xl'],
    gap: spacing.lg,
  },
  message: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.light,
    textAlign: 'center',
  },
  button: {
    minWidth: 140,
  },
});
