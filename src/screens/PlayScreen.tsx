// Gamified quiz: intro/stats -> live round (hearts, combo, timer) -> results.
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { SavedWord } from '../types';
import { getSaved } from '../storage/store';
import { buildQuiz, MIN_WORDS, Question } from '../services/quiz';
import {
  ACHIEVEMENTS,
  getProgress,
  levelInfo,
  Progress,
  QuizRecord,
  recordQuizResult,
} from '../services/progress';
import { haptic } from '../services/haptics';
import LevelHeader from '../components/LevelHeader';
import Confetti from '../components/Confetti';
import AnimatedMount from '../components/AnimatedMount';
import PressableScale from '../components/PressableScale';
import { colors, radius, spacing, font, shadow } from '../theme';

const QUESTION_MS = 18000;
const LIVES = 3;
const REVEAL_DELAY = 950;

type Phase = 'intro' | 'playing' | 'results';

export default function PlayScreen() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [saved, setSaved] = useState<SavedWord[]>([]);
  const [phase, setPhase] = useState<Phase>('intro');

  // round state (for display)
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [lives, setLives] = useState(LIVES);
  const [combo, setCombo] = useState(0);
  const [result, setResult] = useState<QuizRecord | null>(null);

  // round accumulators (refs avoid stale closures inside timers)
  const xpRef = useRef(0);
  const correctRef = useRef(0);
  const bestComboRef = useRef(0);
  const lockedRef = useRef(false);
  const qStartRef = useRef(0);
  const bar = useRef(new Animated.Value(1)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(() => {
    getProgress().then(setProgress);
    getSaved().then(setSaved);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (advanceRef.current) clearTimeout(advanceRef.current);
      };
    }, [reload])
  );

  // Start / restart the per-question timer whenever we move to a new question.
  React.useEffect(() => {
    if (phase !== 'playing') return;
    const q = questions[qIndex];
    if (!q) return;
    lockedRef.current = false;
    setSelected(null);
    qStartRef.current = Date.now();
    bar.setValue(1);
    const anim = Animated.timing(bar, { toValue: 0, duration: QUESTION_MS, useNativeDriver: false });
    anim.start();
    const t = setTimeout(() => {
      if (!lockedRef.current) handleTimeout();
    }, QUESTION_MS);
    timeoutRef.current = t;
    return () => {
      clearTimeout(t);
      anim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIndex, questions]);

  function startQuiz() {
    const qs = buildQuiz(saved, 8);
    if (qs.length < 4) {
      Alert.alert('Not enough variety', 'Save a few more different words and try again.');
      return;
    }
    xpRef.current = 0;
    correctRef.current = 0;
    bestComboRef.current = 0;
    setQuestions(qs);
    setQIndex(0);
    setSelected(null);
    setLives(LIVES);
    setCombo(0);
    setResult(null);
    haptic.medium();
    setPhase('playing');
  }

  function scheduleNext(newLives: number) {
    advanceRef.current = setTimeout(() => {
      const isLast = qIndex + 1 >= questions.length;
      if (newLives <= 0 || isLast) finish();
      else setQIndex((i) => i + 1);
    }, REVEAL_DELAY);
  }

  function handleAnswer(i: number) {
    if (lockedRef.current) return;
    lockedRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    bar.stopAnimation();

    const q = questions[qIndex];
    const correct = i === q.correctIndex;
    setSelected(i);

    let newLives = lives;
    let newCombo = combo;
    if (correct) {
      haptic.success();
      newCombo = combo + 1;
      const elapsed = Date.now() - qStartRef.current;
      const speed = Math.max(0, 1 - elapsed / QUESTION_MS);
      const gained = 10 + Math.round(speed * 5) + Math.min(Math.max(newCombo - 1, 0), 5);
      xpRef.current += gained;
      correctRef.current += 1;
      bestComboRef.current = Math.max(bestComboRef.current, newCombo);
    } else {
      haptic.warning();
      newCombo = 0;
      newLives = lives - 1;
    }
    setCombo(newCombo);
    setLives(newLives);
    scheduleNext(newLives);
  }

  function handleTimeout() {
    if (lockedRef.current) return;
    lockedRef.current = true;
    bar.stopAnimation();
    haptic.warning();
    setSelected(-1); // reveal correct, nothing chosen
    const newLives = lives - 1;
    setLives(newLives);
    setCombo(0);
    scheduleNext(newLives);
  }

  async function finish() {
    const answered = qIndex + 1;
    const correct = correctRef.current;
    const perfect = correct === answered && answered > 0;
    const xpEarned = xpRef.current + (perfect ? 20 : 0);
    const rec = await recordQuizResult(
      { correct, total: answered, bestCombo: bestComboRef.current, xpEarned, score: xpEarned },
      saved.length
    );
    setProgress(rec.progress);
    setResult(rec);
    setPhase('results');
    haptic.success();
  }

  // ---------------- RENDER ----------------

  if (phase === 'playing') return renderPlaying();
  if (phase === 'results' && result) return renderResults(result);
  return renderIntro();

  function renderIntro() {
    const enough = saved.length >= MIN_WORDS;
    const acc =
      progress && progress.totalAnswered > 0
        ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
        : 0;
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.introContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>Play</Text>

          {progress && (
            <AnimatedMount delay={0}>
              <LevelHeader progress={progress} />
            </AnimatedMount>
          )}

          {progress && (
            <AnimatedMount delay={70} style={styles.statRow}>
              <Stat label="Best" value={`${progress.bestScore}`} hint="XP" />
              <Stat label="Accuracy" value={`${acc}%`} />
              <Stat label="Quizzes" value={`${progress.quizzesPlayed}`} />
            </AnimatedMount>
          )}

          <AnimatedMount delay={140}>
            {enough ? (
              <PressableScale style={styles.startBtn} onPress={startQuiz}>
                <Text style={styles.startBtnText}>▶  Start quiz</Text>
                <Text style={styles.startBtnSub}>{Math.min(saved.length, 8)} questions · {LIVES} lives</Text>
              </PressableScale>
            ) : (
              <View style={styles.lockCard}>
                <Text style={styles.lockEmoji}>🔒</Text>
                <Text style={styles.lockText}>
                  Save at least {MIN_WORDS} words to unlock the quiz.{'\n'}You have {saved.length}.
                </Text>
              </View>
            )}
          </AnimatedMount>

          {progress && (
            <AnimatedMount delay={210}>
              <Text style={styles.sectionLabel}>ACHIEVEMENTS</Text>
              <View style={styles.badgeGrid}>
                {ACHIEVEMENTS.map((a) => {
                  const got = progress.achievements.includes(a.id);
                  return (
                    <View key={a.id} style={[styles.badge, !got && styles.badgeLocked]}>
                      <Text style={[styles.badgeEmoji, !got && styles.badgeDim]}>{a.emoji}</Text>
                      <Text style={[styles.badgeTitle, !got && styles.badgeDim]} numberOfLines={1}>
                        {a.title}
                      </Text>
                      <Text style={styles.badgeDesc} numberOfLines={2}>
                        {a.desc}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </AnimatedMount>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  function renderPlaying() {
    const q = questions[qIndex];
    if (!q) return <SafeAreaView style={styles.safe} edges={['top']} />;
    const locked = selected !== null;
    const barW = bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* HUD */}
        <View style={styles.hud}>
          <Text style={styles.hudCount}>
            {qIndex + 1}/{questions.length}
          </Text>
          <View style={styles.hearts}>
            {Array.from({ length: LIVES }).map((_, i) => (
              <Text key={i} style={styles.heart}>
                {i < lives ? '❤️' : '🤍'}
              </Text>
            ))}
          </View>
          {combo >= 2 ? (
            <View style={styles.comboPill}>
              <Text style={styles.comboText}>🔥 {combo}×</Text>
            </View>
          ) : (
            <View style={{ width: 56 }} />
          )}
        </View>

        {/* timer */}
        <View style={styles.timerTrack}>
          <Animated.View style={[styles.timerFill, { width: barW }]} />
        </View>

        {/* question */}
        <AnimatedMount key={qIndex} style={styles.questionWrap} offset={20}>
          <Text style={styles.qLabel}>{q.label}</Text>
          <View style={styles.qCard}>
            <Text style={styles.qPrompt}>{q.prompt}</Text>
          </View>
        </AnimatedMount>

        <View style={styles.options}>
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correctIndex;
            const isChosen = i === selected;
            let style = styles.option;
            let txt = styles.optionText;
            if (locked) {
              if (isCorrect) {
                style = { ...styles.option, ...styles.optCorrect };
                txt = { ...styles.optionText, ...styles.optTextStrong };
              } else if (isChosen) {
                style = { ...styles.option, ...styles.optWrong };
                txt = { ...styles.optionText, ...styles.optTextStrong };
              } else {
                style = { ...styles.option, ...styles.optDim };
              }
            }
            return (
              <PressableScale
                key={i}
                style={style}
                onPress={() => handleAnswer(i)}
                disabled={locked}
              >
                <Text style={txt}>{opt}</Text>
                {locked && isCorrect && <Text style={styles.tick}>✓</Text>}
                {locked && isChosen && !isCorrect && <Text style={styles.cross}>✕</Text>}
              </PressableScale>
            );
          })}
        </View>
      </SafeAreaView>
    );
  }

  function renderResults(rec: QuizRecord) {
    const answered = correctRef.current + (LIVES - lives); // attempted count proxy
    const acc =
      answered > 0 ? Math.round((correctRef.current / Math.max(answered, 1)) * 100) : 0;
    const xpGained = rec.progress.xp; // total now; show round xp separately
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Confetti />
        <ScrollView contentContainerStyle={styles.resultsContent} showsVerticalScrollIndicator={false}>
          <AnimatedMount>
            <Text style={styles.resultEmoji}>{acc >= 80 ? '🏆' : acc >= 50 ? '🎉' : '💪'}</Text>
            <Text style={styles.resultTitle}>
              {acc >= 80 ? 'Brilliant!' : acc >= 50 ? 'Nice work!' : 'Keep going!'}
            </Text>
          </AnimatedMount>

          <AnimatedMount delay={80} style={styles.resultCard}>
            <View style={styles.resultRow}>
              <Stat label="Correct" value={`${correctRef.current}`} />
              <Stat label="Accuracy" value={`${acc}%`} />
              <Stat label="XP earned" value={`+${xpRef.current}`} hint="this round" />
            </View>
          </AnimatedMount>

          {rec.leveledUp && (
            <AnimatedMount delay={160} style={styles.levelUp}>
              <Text style={styles.levelUpText}>
                ⬆️  Level up!  {levelInfo(rec.progress.xp).title} (Lv {rec.toLevel})
              </Text>
            </AnimatedMount>
          )}

          {rec.unlocked.length > 0 && (
            <AnimatedMount delay={230} style={styles.unlockWrap}>
              <Text style={styles.sectionLabel}>NEW ACHIEVEMENTS</Text>
              {rec.unlocked.map((a) => (
                <View key={a.id} style={styles.unlockRow}>
                  <Text style={styles.unlockEmoji}>{a.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.unlockTitle}>{a.title}</Text>
                    <Text style={styles.unlockDesc}>{a.desc}</Text>
                  </View>
                </View>
              ))}
            </AnimatedMount>
          )}

          <AnimatedMount delay={300} style={styles.resultBtns}>
            <PressableScale style={styles.againBtn} onPress={startQuiz}>
              <Text style={styles.againText}>Play again</Text>
            </PressableScale>
            <PressableScale style={styles.doneBtn} onPress={() => setPhase('intro')}>
              <Text style={styles.doneText}>Done</Text>
            </PressableScale>
          </AnimatedMount>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {!!hint && <Text style={styles.statHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  introContent: { padding: spacing.lg, gap: spacing.md },
  h1: { ...font.h1, color: colors.text, marginBottom: spacing.xs },

  statRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  statHint: { color: colors.textFaint, fontSize: 10 },

  startBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...shadow,
  },
  startBtnText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  startBtnSub: { color: '#EAF0FF', fontSize: 13, marginTop: 2 },

  lockCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockEmoji: { fontSize: 40, marginBottom: spacing.sm },
  lockText: { color: colors.textDim, textAlign: 'center', fontSize: 15, lineHeight: 22 },

  sectionLabel: { ...font.label, color: colors.textFaint, marginBottom: spacing.sm, marginTop: spacing.sm },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeLocked: { opacity: 0.55 },
  badgeEmoji: { fontSize: 26 },
  badgeDim: { opacity: 0.5 },
  badgeTitle: { color: colors.text, fontWeight: '700', fontSize: 14, marginTop: 4 },
  badgeDesc: { color: colors.textDim, fontSize: 12, marginTop: 2 },

  // HUD
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  hudCount: { color: colors.textDim, fontWeight: '700', width: 56 },
  hearts: { flexDirection: 'row', gap: 3 },
  heart: { fontSize: 18 },
  comboPill: {
    width: 56,
    alignItems: 'flex-end',
  },
  comboText: { color: colors.yellow, fontWeight: '800', fontSize: 15 },

  timerTrack: {
    height: 6,
    backgroundColor: colors.bgElev,
    borderRadius: radius.pill,
    margin: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  timerFill: { height: '100%', backgroundColor: colors.accent },

  questionWrap: { paddingHorizontal: spacing.lg },
  qLabel: { color: colors.textDim, fontSize: 14, marginBottom: spacing.sm },
  qCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  qPrompt: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', lineHeight: 32 },

  options: { padding: spacing.lg, gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionText: { color: colors.text, fontSize: 16, flex: 1 },
  optTextStrong: { fontWeight: '700' },
  optCorrect: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  optWrong: { backgroundColor: colors.redSoft, borderColor: colors.red },
  optDim: { opacity: 0.5 },
  tick: { color: colors.green, fontSize: 18, fontWeight: '800', marginLeft: spacing.sm },
  cross: { color: colors.red, fontSize: 18, fontWeight: '800', marginLeft: spacing.sm },

  // results
  resultsContent: { padding: spacing.lg, alignItems: 'center', gap: spacing.md },
  resultEmoji: { fontSize: 72, textAlign: 'center' },
  resultTitle: { ...font.h1, color: colors.text, textAlign: 'center' },
  resultCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultRow: { flexDirection: 'row', gap: spacing.sm },
  levelUp: {
    width: '100%',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  levelUpText: { color: colors.accent, fontWeight: '800', fontSize: 16, textAlign: 'center' },
  unlockWrap: { width: '100%' },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unlockEmoji: { fontSize: 28 },
  unlockTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  unlockDesc: { color: colors.textDim, fontSize: 13 },
  resultBtns: { width: '100%', gap: spacing.sm, marginTop: spacing.sm },
  againBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  againText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  doneBtn: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  doneText: { color: colors.text, fontWeight: '700', fontSize: 16 },
});
