// Shows current level, title, animated XP progress bar, and streak flame.
import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { Progress, levelInfo } from '../services/progress';
import { colors, radius, spacing, font } from '../theme';

export default function LevelHeader({ progress }: { progress: Progress }) {
  const info = levelInfo(progress.xp);
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: info.ratio,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [fill, info.ratio]);

  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelNum}>{info.level}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{info.title}</Text>
          <Text style={styles.sub}>
            {info.intoLevel} / {info.forNext} XP to level {info.level + 1}
          </Text>
        </View>
        <View style={styles.streak}>
          <Text style={styles.streakFlame}>🔥</Text>
          <Text style={styles.streakNum}>{progress.streakCount}</Text>
        </View>
      </View>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  title: { ...font.title, color: colors.text },
  sub: { color: colors.textDim, fontSize: 12.5, marginTop: 1 },
  streak: { alignItems: 'center' },
  streakFlame: { fontSize: 18 },
  streakNum: { color: colors.yellow, fontSize: 13, fontWeight: '800' },
  barTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElev,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accent },
});
