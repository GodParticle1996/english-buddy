// Builds a quiz round from the user's saved words — fully offline.
// Other saved words supply the wrong-answer choices, so no API call is needed.
import { SavedWord, WordEntry } from '../types';

export type QType = 'def' | 'word' | 'bn' | 'hi';

export type Question = {
  type: QType;
  label: string; // what the player is asked to do
  prompt: string; // the main thing shown
  options: string[];
  correctIndex: number;
  word: string; // the underlying answer word (for review)
};

export const MIN_WORDS = 4;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDistinct(pool: string[], exclude: string, n: number): string[] {
  const seen = new Set([exclude.toLowerCase()]);
  const out: string[] = [];
  for (const v of shuffle(pool)) {
    const key = v.trim().toLowerCase();
    if (!v.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length === n) break;
  }
  return out;
}

function defOf(e: WordEntry): string {
  return e.meanings[0]?.definition ?? '';
}

// Which question types are possible given the available data.
function feasibleTypes(subject: WordEntry, all: WordEntry[]): QType[] {
  const types: QType[] = ['def', 'word'];
  const bnPool = all.filter((e) => e.bengali.meaning_latin.trim()).length;
  const hiPool = all.filter((e) => e.hindi.meaning_latin.trim()).length;
  if (subject.bengali.meaning_latin.trim() && bnPool >= 4) types.push('bn');
  if (subject.hindi.meaning_latin.trim() && hiPool >= 4) types.push('hi');
  return types;
}

function buildOne(subject: WordEntry, all: WordEntry[]): Question | null {
  const others = all.filter((e) => e.word.toLowerCase() !== subject.word.toLowerCase());
  const type = shuffle(feasibleTypes(subject, all))[0];

  let correct: string;
  let label: string;
  let prompt: string;
  let pool: string[];

  switch (type) {
    case 'word':
      correct = subject.word;
      label = 'Which word means this?';
      prompt = defOf(subject);
      pool = others.map((e) => e.word);
      break;
    case 'bn':
      correct = subject.bengali.meaning_latin;
      label = `Bengali meaning of “${subject.word}”?`;
      prompt = subject.word;
      pool = others.map((e) => e.bengali.meaning_latin);
      break;
    case 'hi':
      correct = subject.hindi.meaning_latin;
      label = `Hindi meaning of “${subject.word}”?`;
      prompt = subject.word;
      pool = others.map((e) => e.hindi.meaning_latin);
      break;
    case 'def':
    default:
      correct = defOf(subject);
      label = `What does “${subject.word}” mean?`;
      prompt = subject.word;
      pool = others.map((e) => defOf(e));
      break;
  }

  if (!correct.trim()) return null;
  const distractors = pickDistinct(pool, correct, 3);
  if (distractors.length < 3) return null;

  const options = shuffle([correct, ...distractors]);
  return {
    type,
    label,
    prompt,
    options,
    correctIndex: options.indexOf(correct),
    word: subject.word,
  };
}

export function buildQuiz(saved: SavedWord[], count = 8): Question[] {
  const all = saved.map((s) => s.entry);
  if (all.length < MIN_WORDS) return [];
  const subjects = shuffle(all).slice(0, count);
  const out: Question[] = [];
  for (const s of subjects) {
    const q = buildOne(s, all);
    if (q) out.push(q);
  }
  return out;
}
