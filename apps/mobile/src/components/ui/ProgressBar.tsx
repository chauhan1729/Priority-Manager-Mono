import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { borderRadius } from '../../theme/spacing';

interface ProgressBarProps {
  percent: number; // 0–100
  style?: ViewStyle;
  color?: string | undefined;
}

export function ProgressBar({ percent, style, color }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <View style={[styles.track, style]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped}%` as `${number}%` },
          color ? { backgroundColor: color } : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.blue[600],
    borderRadius: borderRadius.full,
  },
});
