import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Confetti particle
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = [
  colors.blue[400],
  colors.green[400],
  colors.amber[400],
  colors.red[400],
  colors.purple[400],
  '#FF69B4',
  '#00CED1',
];

interface ParticleConfig {
  x: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
}

function generateParticles(count: number): ParticleConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * SCREEN_WIDTH,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    delay: Math.random() * 400,
    duration: 1200 + Math.random() * 800,
    size: 6 + Math.random() * 8,
  }));
}

function ConfettiParticle({ config }: { config: ParticleConfig }) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(config.delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT * 0.7,
          duration: config.duration,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: config.duration - 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]),
        Animated.timing(rotate, {
          toValue: Math.random() > 0.5 ? 3 : -3,
          duration: config.duration,
          useNativeDriver: true,
        }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [config, translateY, opacity, rotate]);

  const rotateInterp = rotate.interpolate({
    inputRange: [-3, 3],
    outputRange: ['-360deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: config.x,
          width: config.size,
          height: config.size,
          backgroundColor: config.color,
          borderRadius: config.size / 4,
          transform: [{ translateY }, { rotate: rotateInterp }],
          opacity,
        },
      ]}
      pointerEvents="none"
    />
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

const PARTICLES = generateParticles(40);

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function CompletionCelebrationModal({ visible, onClose }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.5);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Confetti */}
        <View style={styles.confettiContainer} pointerEvents="none">
          {PARTICLES.map((p, i) => (
            <ConfettiParticle key={i} config={p} />
          ))}
        </View>

        {/* Card */}
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>All Done!</Text>
          <Text style={styles.subtitle}>
            You completed all activities for today. Great work!
          </Text>
          <TouchableOpacity style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>Thanks!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particle: {
    position: 'absolute',
    top: 0,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 10,
  },
  emoji: { fontSize: 56, lineHeight: 64 },
  title: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['3xl'],
    color: colors.ink.DEFAULT,
  },
  subtitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[500],
    textAlign: 'center',
  },
  btn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.blue[600],
    marginTop: spacing.sm,
  },
  btnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
