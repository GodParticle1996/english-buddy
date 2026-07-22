// AsyncStorage-backed persistence for saved words and search history.
// Plenty fast for a personal vocabulary list; can migrate to SQLite later.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedWord, HistoryItem, WordEntry } from '../types';
import { newSchedule } from '../spaced/sm2';

const SAVED_KEY = 'eb.saved.v1';
const HISTORY_KEY = 'eb.history.v1';
const HISTORY_LIMIT = 200;

function keyOf(word: string): string {
  return word.trim().toLowerCase();
}

// ---------- Saved words ----------

export async function getSaved(): Promise<SavedWord[]> {
  const raw = await AsyncStorage.getItem(SAVED_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedWord[];
  } catch {
    return [];
  }
}

async function writeSaved(list: SavedWord[]): Promise<void> {
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(list));
}

export async function isSaved(word: string): Promise<boolean> {
  const list = await getSaved();
  return list.some((s) => keyOf(s.entry.word) === keyOf(word));
}

export async function saveWord(entry: WordEntry): Promise<SavedWord[]> {
  const list = await getSaved();
  if (list.some((s) => keyOf(s.entry.word) === keyOf(entry.word))) return list;
  const card: SavedWord = { entry, savedAt: Date.now(), ...newSchedule() };
  const next = [card, ...list];
  await writeSaved(next);
  return next;
}

export async function removeWord(word: string): Promise<SavedWord[]> {
  const list = await getSaved();
  const next = list.filter((s) => keyOf(s.entry.word) !== keyOf(word));
  await writeSaved(next);
  return next;
}

export async function updateSaved(card: SavedWord): Promise<void> {
  const list = await getSaved();
  const next = list.map((s) =>
    keyOf(s.entry.word) === keyOf(card.entry.word) ? card : s
  );
  await writeSaved(next);
}

// ---------- History ----------

export async function getHistory(): Promise<HistoryItem[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as HistoryItem[];
  } catch {
    return [];
  }
}

export async function addHistory(query: string, word: string): Promise<void> {
  const list = await getHistory();
  // De-dupe consecutive lookups of the same word; keep newest first.
  const filtered = list.filter((h) => keyOf(h.word) !== keyOf(word));
  const next = [{ query, word, at: Date.now() }, ...filtered].slice(0, HISTORY_LIMIT);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}
