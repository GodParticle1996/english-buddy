// Lightweight shimmer placeholder shown while a lookup is loading.
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

function Bar({ w, h = 16, style }: { w: ViewStyle['width']; h?: number; style?: ViewStyle }) {
  return <View style={[styles.bar, { width: w, height: h }, style]} />;
}

export default function Skeleton() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.wrap, { opacity: pulse }]}>
      <Bar w={180} h={34} />
      <Bar w={90} h={16} style={{ marginTop: spacing.sm }} />

      <View style={styles.block}>
        <Bar w={70} h={12} />
        <Bar w={'100%'} h={18} style={{ marginTop: spacing.md }} />
        <Bar w={'85%'} h={18} style={{ marginTop: spacing.sm }} />
        <Bar w={'60%'} h={14} style={{ marginTop: spacing.md }} />
      </View>

      <View style={styles.block}>
        <Bar w={90} h={12} />
        <View style={styles.row}>
          <Bar w={64} h={28} style={{ borderRadius: radius.pill }} />
          <Bar w={80} h={28} style={{ borderRadius: radius.pill }} />
          <Bar w={56} h={28} style={{ borderRadius: radius.pill }} />
        </View>
      </View>

      <View style={styles.block}>
        <Bar w={110} h={12} />
        <Bar w={'100%'} h={16} style={{ marginTop: spacing.md }} />
        <Bar w={'70%'} h={16} style={{ marginTop: spacing.sm }} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg },
  bar: { backgroundColor: colors.cardAlt, borderRadius: radius.sm },
  block: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
