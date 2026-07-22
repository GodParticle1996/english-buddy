# EnglishBuddy 📖

A personal iOS (Expo / React Native) app to learn English as a Bengali/Hindi speaker.

Search any word by **typing or speaking** — in **English, Bengali, or Hindi** — and get one rich card with:

- English meaning(s) by part of speech + IPA pronunciation (tap 🔊 to hear)
- Natural example sentences
- Synonyms & antonyms
- **Gen-Z / casual** usage examples
- **Bengali** meaning + example in Latin/Roman script
- **Hindi** meaning + example in Latin/Roman script

Plus: **Saved words**, **Word of the day**, **Search history**, and **Flashcards** with spaced repetition (SM-2).

## How it works

All dictionary content comes from one structured LLM call to **TokenMix** (OpenAI-compatible API), using the `gemini-3.1-flash-lite-preview` model. **Voice search** records audio (expo-audio) and transcribes it via TokenMix's `whisper-1` endpoint — so it works inside Expo Go, no native build needed. Both models are swappable via `.env`.

### Automatic Groq fallback

If a TokenMix call fails for **any** reason (daily limit / quota / rate-limit / outage), the app automatically retries the same request on **Groq** (also OpenAI-compatible) — `llama-3.3-70b-versatile` for lookups and `whisper-large-v3` for voice. This applies to lookups *and* voice transcription. To enable it, add a free Groq key (https://console.groq.com/keys) to `.env`:

```
EXPO_PUBLIC_GROQ_API_KEY=gsk_...
```

Provider order is TokenMix → Groq (see `src/services/providers.ts`). If you'd rather make Groq primary, just swap the two blocks there.

## Setup

1. Install dependencies (already done if you scaffolded it):
   ```bash
   npm install
   ```
2. Create your `.env` from the template and add your TokenMix key
   (get one free at https://tokenmix.ai/dashboard/keys):
   ```bash
   cp .env.example .env
   # then edit .env and paste your key
   ```

## Run it on your iPhone (no Mac needed)

1. Install **Expo Go** from the App Store on your iPhone.
2. Start the dev server:
   ```bash
   npx expo start
   ```
3. Scan the QR code with the iPhone Camera app → opens in Expo Go.

> **On WSL / Windows:** LAN QR scanning often fails because of WSL networking.
> Use the tunnel instead:
> ```bash
> npx expo start --tunnel
> ```

## Project structure

```
App.tsx                     # Bottom-tab navigation (5 tabs)
src/
  config.ts                 # Reads API key/model from .env
  types.ts                  # WordEntry / SavedWord / HistoryItem
  theme.ts                  # Colors + spacing tokens
  services/
    llm.ts                  # TokenMix chat-completions client
    dictionary.ts           # Prompt + JSON parsing -> WordEntry
    wordOfDay.ts            # Deterministic daily word (cached)
    speak.ts                # expo-speech pronunciation
  storage/store.ts          # AsyncStorage: saved words + history
  spaced/sm2.ts             # SM-2 spaced-repetition scheduler
  components/WordCardView.tsx
  screens/                  # Lookup, WordOfDay, Saved, Flashcards, History
```

## Notes & next steps

- `EXPO_PUBLIC_*` env vars are embedded in the JS bundle — fine for **personal use only**.
  Don't publish this app with your key inside it.
- **Voice input** works in Expo Go via cloud transcription (record → Whisper → search).
  The first tap will ask for microphone permission.
- Possible future additions: home-screen widget for word of the day, notifications,
  offline caching of full lookups, export of saved words.
