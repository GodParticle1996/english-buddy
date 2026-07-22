// Picks a deterministic "word of the day" and caches the looked-up entry per day.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WordEntry } from '../types';
import { lookupWord } from './dictionary';

const CACHE_KEY = 'eb.wotd.v1';

// A small curated pool of useful, slightly-advanced words to learn.
const POOL = [
  'serendipity', 'eloquent', 'resilient', 'ambiguous', 'meticulous',
  'nostalgia', 'pragmatic', 'candid', 'inevitable', 'profound',
  'wholesome', 'genuine', 'spontaneous', 'humble', 'vibrant',
  'curious', 'persevere', 'gratitude', 'empathy', 'authentic',
  'diligent', 'optimistic', 'versatile', 'sincere', 'thrive',
  'overwhelm', 'subtle', 'vivid', 'concise', 'tedious',
];

function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Deterministic index from the date string so everyone gets the same word per day.
function indexForDay(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % POOL.length;
}

export function wordOfTheDay(d: Date = new Date()): string {
  return POOL[indexForDay(todayKey(d))];
}

type Cache = { day: string; entry: WordEntry };

export async function getWordOfDayEntry(): Promise<WordEntry> {
  const day = todayKey();
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (raw) {
    try {
      const cached = JSON.parse(raw) as Cache;
      if (cached.day === day) return cached.entry;
    } catch {
      // fall through and re-fetch
    }
  }
  const entry = await lookupWord(wordOfTheDay());
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ day, entry } satisfies Cache));
  return entry;
}
