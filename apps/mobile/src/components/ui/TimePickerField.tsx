import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

interface TimePickerFieldProps {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
}

export function TimePickerField({ label, value, onChange, placeholder = 'Select time' }: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const displayValue = value
    ? value.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (selected) onChange(selected);
  };

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.value, !value && styles.placeholder]}>
          {displayValue ?? placeholder}
        </Text>
        <Text style={styles.icon}>🕐</Text>
      </TouchableOpacity>
      {open ? (
        <DateTimePicker
          mode="time"
          value={value ?? new Date()}
          onChange={handleChange}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        />
      ) : null}
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.blue[100],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
  },
  value: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
  },
  placeholder: {
    color: colors.gray[400],
  },
  icon: {
    fontSize: 16,
  },
});
