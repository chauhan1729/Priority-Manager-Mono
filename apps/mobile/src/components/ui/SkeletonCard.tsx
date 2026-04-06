import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { borderRadius, spacing } from '../../theme/spacing';
import { colors } from '../../theme/colors';

// ---------------------------------------------------------------------------
// Single animated skeleton line
// ---------------------------------------------------------------------------

function SkeletonLine({ width, height = 12 }: { width: string | number; height?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.line,
        { width, height, borderRadius: height / 2, opacity },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Card-shaped skeleton placeholder
// ---------------------------------------------------------------------------

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <SkeletonLine width="65%" height={14} />
        <SkeletonLine width={60} height={20} />
      </View>
      <SkeletonLine width="40%" height={10} />
      <SkeletonLine width="80%" height={10} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stack of skeleton cards for loading state
// ---------------------------------------------------------------------------

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.blue[50],
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  line: {
    backgroundColor: colors.gray[200],
  },
});
