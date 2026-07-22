// Spaced-repetition review of saved words that are due (SM-2).
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { SavedWord } from '../types';
import { getSaved, updateSaved } from '../storage/store';
import { isDue, review } from '../spaced/sm2';
import { speak } from '../services/speak';
import { haptic } from '../services/haptics';
import { grantXp } from '../services/progress';
import AnimatedMount from '../components/AnimatedMount';
import PressableScale from '../components/PressableScale';
import { colors, radius, spacing } from '../theme';

const GRADES = [
  { label: 'Forgot', grade: 0, color: colors.red },
  { label: 'Hard', grade: 3, color: colors.yellow },
  { label: 'Good', grade: 4, color: colors.accent },
  { label: 'Easy', grade: 5, color: colors.green },
];

export default function FlashcardsScreen() {
  const [queue, setQueue] = useState<SavedWord[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const load = useCallback(() => {
    getSaved().then((all) => {
      setQueue(all.filter((c) => isDue(c)));
      setIndex(0);
      setRevealed(false);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const current = queue[index];

  async function grade(g: number) {
    if (!current) return;
    g < 3 ? haptic.warning() : haptic.success();
    await updateSaved(review(current, g));
    // Reward recall: a little XP keeps the streak alive and feeds the Play tab.
    await grantXp(g >= 4 ? 5 : g === 3 ? 3 : 1);
    const next = index + 1;
    setRevealed(false);
    setIndex(next);
  }

  // Done / nothing due
  if (!current) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>🎉</Text>
          <Text style={styles.doneTitle}>All caught up!</Text>
          <Text style={styles.dim}>No cards due right now. Save more words and come back later.</Text>
          <Pressable style={styles.reloadBtn} onPress={load}>
            <Text style={styles.reloadText}>Refresh</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const e = current.entry;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.progress}>
        {index + 1} / {queue.length} due
      </Text>

      {/* key={index} replays the entrance animation for each new card */}
      <AnimatedMount key={index} delay={0} offset={24} style={styles.cardWrap}>
        <Pressable
          style={styles.card}
          onPress={() => {
            if (!revealed) haptic.tap();
            setRevealed(true);
          }}
        >
          <Pressable style={styles.speaker} onPress={() => speak(e.word)} hitSlop={10}>
            <Text style={styles.speakerText}>🔊</Text>
          </Pressable>

          <Text style={styles.word}>{e.word}</Text>
          {!!e.phonetic && <Text style={styles.phonetic}>{e.phonetic}</Text>}

          {revealed ? (
            <AnimatedMount style={styles.answer} offset={10} duration={300}>
              <Text style={styles.definition}>{e.meanings[0]?.definition}</Text>
              <Text style={styles.gloss}>BN: {e.bengali.meaning_latin}</Text>
              <Text style={styles.gloss}>HI: {e.hindi.meaning_latin}</Text>
            </AnimatedMount>
          ) : (
            <Text style={styles.tapHint}>Tap to reveal</Text>
          )}
        </Pressable>
      </AnimatedMount>

      {revealed && (
        <AnimatedMount style={styles.gradeRow} offset={16} duration={260}>
          {GRADES.map((g) => (
            <PressableScale
              key={g.grade}
              style={[styles.gradeBtn, { backgroundColor: g.color }]}
              onPress={() => grade(g.grade)}
            >
              <Text style={styles.gradeText}>{g.label}</Text>
            </PressableScale>
          ))}
        </AnimatedMount>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  progress: { color: colors.textDim, textAlign: 'center', marginTop: spacing.md, fontSize: 14 },
  cardWrap: { flex: 1 },
  card: {
    flex: 1,
    margin: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  speaker: { position: 'absolute', top: spacing.lg, right: spacing.lg },
  speakerText: { fontSize: 24 },
  word: { color: colors.text, fontSize: 40, fontWeight: '800', textAlign: 'center' },
  phonetic: { color: colors.accent, fontSize: 16, marginTop: spacing.sm },
  tapHint: { color: colors.textDim, marginTop: spacing.xl, fontSize: 15 },
  answer: { marginTop: spacing.xl, alignItems: 'center' },
  definition: { color: colors.text, fontSize: 18, textAlign: 'center', lineHeight: 26 },
  gloss: { color: colors.textDim, fontSize: 15, marginTop: spacing.sm, textAlign: 'center' },
  gradeRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingTop: 0 },
  gradeBtn: { flex: 1, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  gradeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  bigEmoji: { fontSize: 64 },
  doneTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: spacing.md },
  dim: { color: colors.textDim, fontSize: 15, textAlign: 'center', marginTop: spacing.md, lineHeight: 22 },
  reloadBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  reloadText: { color: colors.text, fontWeight: '600' },
});
