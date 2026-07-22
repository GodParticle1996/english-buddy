// Gamification backbone: XP, levels, daily streak, lifetime stats, achievements.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'eb.progress.v1';
const XP_PER_LEVEL = 120;

export type Achievement = { id: string; emoji: string; title: string; desc: string };

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_quiz', emoji: '🎯', title: 'First Steps', desc: 'Finish your first quiz' },
  { id: 'perfect', emoji: '💯', title: 'Flawless', desc: 'Get a perfect round' },
  { id: 'combo5', emoji: '🔥', title: 'On Fire', desc: 'Reach a 5× combo' },
  { id: 'streak3', emoji: '📅', title: 'Consistent', desc: '3-day streak' },
  { id: 'streak7', emoji: '🗓️', title: 'Dedicated', desc: '7-day streak' },
  { id: 'level5', emoji: '⭐', title: 'Wordsmith', desc: 'Reach level 5' },
  { id: 'words50', emoji: '📚', title: 'Collector', desc: 'Save 50 words' },
  { id: 'xp1000', emoji: '🏆', title: 'Champion', desc: 'Earn 1000 XP' },
];

export type Progress = {
  xp: number;
  streakCount: number;
  lastActiveDay: string | null;
  quizzesPlayed: number;
  bestScore: number;
  totalCorrect: number;
  totalAnswered: number;
  achievements: string[];
};

const DEFAULT: Progress = {
  xp: 0,
  streakCount: 0,
  lastActiveDay: null,
  quizzesPlayed: 0,
  bestScore: 0,
  totalCorrect: 0,
  totalAnswered: 0,
  achievements: [],
};

const TITLES = [
  'Rookie', 'Novice', 'Learner', 'Sharp', 'Wordsmith',
  'Eloquent', 'Fluent', 'Articulate', 'Linguist', 'Polyglot',
];

export function levelInfo(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const intoLevel = xp - (level - 1) * XP_PER_LEVEL;
  const title = TITLES[Math.min(level - 1, TITLES.length - 1)];
  return { level, title, intoLevel, forNext: XP_PER_LEVEL, ratio: intoLevel / XP_PER_LEVEL };
}

function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export async function getProgress(): Promise<Progress> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULT };
  try {
    return { ...DEFAULT, ...(JSON.parse(raw) as Progress) };
  } catch {
    return { ...DEFAULT };
  }
}

async function save(p: Progress): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}

// Update the daily streak in-place on a Progress object.
function bumpStreak(p: Progress): void {
  const today = dayKey();
  if (p.lastActiveDay === today) return;
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  p.streakCount = p.lastActiveDay === yesterday ? p.streakCount + 1 : 1;
  p.lastActiveDay = today;
}

function evaluateAchievements(
  p: Progress,
  ctx: { perfect: boolean; bestCombo: number; savedCount: number }
): Achievement[] {
  const has = new Set(p.achievements);
  const unlocked: Achievement[] = [];
  const tryUnlock = (id: string, cond: boolean) => {
    if (cond && !has.has(id)) {
      has.add(id);
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) unlocked.push(a);
    }
  };

  tryUnlock('first_quiz', p.quizzesPlayed >= 1);
  tryUnlock('perfect', ctx.perfect);
  tryUnlock('combo5', ctx.bestCombo >= 5);
  tryUnlock('streak3', p.streakCount >= 3);
  tryUnlock('streak7', p.streakCount >= 7);
  tryUnlock('level5', levelInfo(p.xp).level >= 5);
  tryUnlock('words50', ctx.savedCount >= 50);
  tryUnlock('xp1000', p.xp >= 1000);

  p.achievements = [...has];
  return unlocked;
}

export type QuizOutcome = {
  correct: number;
  total: number;
  bestCombo: number;
  xpEarned: number;
  score: number;
};

export type QuizRecord = {
  progress: Progress;
  leveledUp: boolean;
  fromLevel: number;
  toLevel: number;
  unlocked: Achievement[];
};

export async function recordQuizResult(o: QuizOutcome, savedCount: number): Promise<QuizRecord> {
  const p = await getProgress();
  const fromLevel = levelInfo(p.xp).level;

  bumpStreak(p);
  p.xp += o.xpEarned;
  p.quizzesPlayed += 1;
  p.totalCorrect += o.correct;
  p.totalAnswered += o.total;
  p.bestScore = Math.max(p.bestScore, o.score);

  const perfect = o.total > 0 && o.correct === o.total;
  const unlocked = evaluateAchievements(p, { perfect, bestCombo: o.bestCombo, savedCount });

  const toLevel = levelInfo(p.xp).level;
  await save(p);
  return { progress: p, leveledUp: toLevel > fromLevel, fromLevel, toLevel, unlocked };
}

// Small XP grants (e.g. flashcard reviews) that also keep the streak alive.
export async function grantXp(amount: number): Promise<void> {
  const p = await getProgress();
  bumpStreak(p);
  p.xp += amount;
  await save(p);
}
