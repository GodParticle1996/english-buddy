// Lookup cache: stores resolved WordEntry results so repeated lookups, history
// taps, and saved words load instantly, for free, and work offline.
//
// Strategy: check saved words -> check cache -> hit the API (and cache it).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WordEntry } from '../types';
import { lookupWord } from './dictionary';
import { getSaved } from '../storage/store';

const CACHE_KEY = 'eb.lookupcache.v1';
const LIMIT = 300;

type CacheEntry = { entry: WordEntry; at: number };
type CacheMap = Record<string, CacheEntry>;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

async function readCache(): Promise<CacheMap> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as CacheMap;
  } catch {
    return {};
  }
}

async function writeCache(map: CacheMap): Promise<void> {
  const keys = Object.keys(map);
  if (keys.length > LIMIT) {
    // Evict the oldest entries (by last access time) down to the limit.
    keys
      .sort((a, b) => map[a].at - map[b].at)
      .slice(0, keys.length - LIMIT)
      .forEach((k) => delete map[k]);
  }
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map));
}

async function put(map: CacheMap, key: string, entry: WordEntry): Promise<void> {
  map[norm(key)] = { entry, at: Date.now() };
}

/** Look up a word, using saved words + cache first to avoid network/API cost. */
export async function lookupCached(query: string): Promise<WordEntry> {
  const key = norm(query);

  // 1) Already saved? Return instantly.
  const saved = await getSaved();
  const savedHit = saved.find((s) => norm(s.entry.word) === key);
  if (savedHit) return savedHit.entry;

  // 2) In the lookup cache?
  const map = await readCache();
  const cached = map[key];
  if (cached) {
    cached.at = Date.now(); // refresh recency
    await writeCache(map);
    return cached.entry;
  }

  // 3) Miss -> hit the API, then cache under both the query and resolved word.
  const entry = await lookupWord(query);
  await put(map, key, entry);
  await put(map, entry.word, entry);
  await writeCache(map);
  return entry;
}
