import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  shadow?: boolean;
}

export function Card({ children, style, shadow = false }: CardProps) {
  return (
    <View style={[styles.card, shadow && styles.shadow, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.blue[100],
    padding: spacing.lg,
  },
  shadow: {
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
});
