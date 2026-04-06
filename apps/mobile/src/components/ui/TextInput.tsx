import React from 'react';
import {
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

interface TextInputProps extends RNTextInputProps {
  label?: string;
}

export function TextInput({ label, style, multiline, ...rest }: TextInputProps) {
  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <RNTextInput
        style={[styles.input, multiline && styles.multiline, style]}
        placeholderTextColor={colors.gray[400]}
        multiline={multiline}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.blue[100],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    minHeight: 44,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: spacing.sm + 2,
  },
});
