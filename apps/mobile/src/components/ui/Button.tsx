import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontWeight, fontFamily } from '../../theme/typography';

type Variant = 'primary' | 'secondary' | 'danger' | 'text';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const containerStyle = [
    styles.base,
    styles[variant],
    (disabled || loading) && styles.disabled,
    style,
  ];

  const labelStyle = [styles.label, styles[`${variant}Label` as keyof typeof styles], textStyle];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.blue[600]}
        />
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
  },
  primary: {
    backgroundColor: colors.blue[600],
  },
  secondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.blue[300],
  },
  danger: {
    backgroundColor: colors.red[500],
  },
  text: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  primaryLabel: {
    color: '#FFFFFF',
  },
  secondaryLabel: {
    color: colors.blue[600],
  },
  dangerLabel: {
    color: '#FFFFFF',
  },
  textLabel: {
    color: colors.blue[600],
  },
});
