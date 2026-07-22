// SM-2 spaced-repetition algorithm (SuperMemo 2).
// grade: 0 = forgot, 3 = hard, 4 = good, 5 = easy (we map UI buttons to these).
import { SavedWord } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function newSchedule(now: number = Date.now()): Pick<
  SavedWord,
  'repetitions' | 'intervalDays' | 'easeFactor' | 'dueAt'
> {
  return { repetitions: 0, intervalDays: 0, easeFactor: 2.5, dueAt: now };
}

export function review(card: SavedWord, grade: number, now: number = Date.now()): SavedWord {
  let { repetitions, intervalDays, easeFactor } = card;

  if (grade < 3) {
    // Failed recall — restart the ladder, review again soon.
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);

    easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;
  }

  return {
    ...card,
    repetitions,
    intervalDays,
    easeFactor,
    dueAt: now + intervalDays * DAY_MS,
  };
}

export function isDue(card: SavedWord, now: number = Date.now()): boolean {
  return card.dueAt <= now;
}
