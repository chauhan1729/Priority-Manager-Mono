import React, { useCallback, useMemo, useRef } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, FlatList } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectPickerFieldProps {
  label?: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SelectPickerField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
}: SelectPickerFieldProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['40%', '60%'], []);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const open = () => sheetRef.current?.expand();
  const close = () => sheetRef.current?.close();

  const handleSelect = (val: string) => {
    onChange(val);
    close();
  };

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  );

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity style={styles.field} onPress={open} activeOpacity={0.7}>
        <Text style={[styles.value, !value && styles.placeholder]}>
          {selectedLabel ?? placeholder}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheet}
        handleIndicatorStyle={styles.handle}
      >
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.option, item.value === value && styles.optionSelected]}
              onPress={() => handleSelect(item.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.optionText, item.value === value && styles.optionTextSelected]}
              >
                {item.label}
              </Text>
              {item.value === value ? <Text style={styles.check}>✓</Text> : null}
            </TouchableOpacity>
          )}
        />
      </BottomSheet>
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
  chevron: {
    fontSize: 20,
    color: colors.gray[400],
    lineHeight: 22,
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  handle: {
    backgroundColor: colors.gray[300],
    width: 40,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  optionSelected: {
    backgroundColor: colors.blue[50],
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  optionText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
  },
  optionTextSelected: {
    fontWeight: fontWeight.semibold,
    color: colors.blue[700],
  },
  check: {
    fontSize: fontSize.base,
    color: colors.blue[600],
    fontWeight: fontWeight.bold,
  },
});
