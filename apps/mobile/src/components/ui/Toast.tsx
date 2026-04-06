import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily, fontWeight } from '../../theme/typography';

type ToastType = 'success' | 'error';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  duration?: number;
  onHide?: () => void;
}

export function Toast({
  message,
  type = 'success',
  visible,
  duration = 3000,
  onHide,
}: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => onHide?.());
    }
  }, [visible, duration, onHide, opacity]);

  if (!visible) return null;

  const bg = type === 'success' ? colors.green[600] : colors.red[600];

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + spacing.sm, backgroundColor: bg, opacity },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

// Convenience hook for managing toast state
export function useToast() {
  const [state, setState] = React.useState<{
    visible: boolean;
    message: string;
    type: ToastType;
  }>({ visible: false, message: '', type: 'success' });

  const show = (message: string, type: ToastType = 'success') =>
    setState({ visible: true, message, type });

  const hide = () => setState((s) => ({ ...s, visible: false }));

  return { toastProps: { ...state, onHide: hide }, show };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
