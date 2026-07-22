// Turns a free-text query (English, Bengali, or Hindi — typed in any script)
// into a structured WordEntry via the LLM.
import { chatJSON, ChatMessage } from './llm';
import { WordEntry, Meaning, LangGloss } from '../types';

const SYSTEM_PROMPT = `You are a friendly bilingual dictionary for a native Bengali/Hindi speaker who is learning English.
The user may type a word in English, OR in Bengali/Hindi (in native script OR romanized). Detect the intended ENGLISH word it refers to and explain THAT English word.

Return ONLY a JSON object with EXACTLY this shape:
{
  "word": string,                       // the English headword
  "phonetic": string,                   // IPA pronunciation, e.g. "/ˈsɛrənˌdɪpɪti/"
  "meanings": [                         // 1-3 distinct senses
    { "partOfSpeech": string, "definition": string, "example": string }
  ],
  "synonyms": string[],                 // 3-6 items, [] if none
  "antonyms": string[],                 // 0-4 items, [] if none
  "genz": string[],                     // 2-3 casual / gen-z / texting-style sentences using the word naturally
  "bengali": { "meaning_latin": string, "example_latin": string },
  "hindi":   { "meaning_latin": string, "example_latin": string }
}

CRITICAL RULES:
- Bengali and Hindi MUST be written in Latin/Roman letters ONLY (transliteration). NEVER use Bangla or Devanagari script.
- Keep definitions simple and clear for an intermediate English learner.
- Examples must be natural, everyday sentences.
- Output valid JSON only. No markdown, no commentary.`;

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string');
}

function asGloss(v: unknown): LangGloss {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    meaning_latin: typeof o.meaning_latin === 'string' ? o.meaning_latin : '',
    example_latin: typeof o.example_latin === 'string' ? o.example_latin : '',
  };
}

function asMeanings(v: unknown): Meaning[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((m) => {
      const o = (m ?? {}) as Record<string, unknown>;
      return {
        partOfSpeech: typeof o.partOfSpeech === 'string' ? o.partOfSpeech : '',
        definition: typeof o.definition === 'string' ? o.definition : '',
        example: typeof o.example === 'string' ? o.example : '',
      };
    })
    .filter((m) => m.definition.length > 0);
}

// Defensive parse: the JSON mode is reliable but we still normalize/validate.
function normalize(raw: string): WordEntry {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const entry: WordEntry = {
    word: typeof parsed.word === 'string' ? parsed.word : '',
    phonetic: typeof parsed.phonetic === 'string' ? parsed.phonetic : '',
    meanings: asMeanings(parsed.meanings),
    synonyms: asStringArray(parsed.synonyms),
    antonyms: asStringArray(parsed.antonyms),
    genz: asStringArray(parsed.genz),
    bengali: asGloss(parsed.bengali),
    hindi: asGloss(parsed.hindi),
  };
  if (!entry.word || entry.meanings.length === 0) {
    throw new Error('Could not understand that word. Try another spelling.');
  }
  return entry;
}

export async function lookupWord(query: string): Promise<WordEntry> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: query.trim() },
  ];
  const raw = await chatJSON(messages);
  return normalize(raw);
}
