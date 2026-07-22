// Shape of one dictionary lookup result (mirrors the JSON the LLM returns).

export type Meaning = {
  partOfSpeech: string;
  definition: string;
  example: string;
};

export type LangGloss = {
  meaning_latin: string; // meaning written in Latin/Roman script
  example_latin: string; // example sentence in Latin/Roman script
};

export type WordEntry = {
  word: string;
  phonetic: string;
  meanings: Meaning[];
  synonyms: string[];
  antonyms: string[];
  genz: string[];
  bengali: LangGloss;
  hindi: LangGloss;
};

// A saved word = a lookup result plus spaced-repetition + bookkeeping metadata.
export type SavedWord = {
  entry: WordEntry;
  savedAt: number;
  // SM-2 spaced repetition fields
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  dueAt: number;
};

export type HistoryItem = {
  query: string;
  word: string;
  at: number;
};
