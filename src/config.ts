// Central runtime config. Reads from Expo's EXPO_PUBLIC_* env vars (.env file).
export const config = {
  // --- Primary provider: TokenMix ---
  apiKey: process.env.EXPO_PUBLIC_TOKENMIX_API_KEY ?? '',
  baseUrl: process.env.EXPO_PUBLIC_TOKENMIX_BASE_URL ?? 'https://api.tokenmix.ai/v1',
  model: process.env.EXPO_PUBLIC_LLM_MODEL ?? 'gemini-3.1-flash-lite-preview',
  transcribeModel: process.env.EXPO_PUBLIC_TRANSCRIBE_MODEL ?? 'whisper-1',

  // --- Fallback provider: Groq (used automatically if TokenMix fails) ---
  groqApiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '',
  groqBaseUrl: process.env.EXPO_PUBLIC_GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
  groqModel: process.env.EXPO_PUBLIC_GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  groqTranscribeModel: process.env.EXPO_PUBLIC_GROQ_TRANSCRIBE_MODEL ?? 'whisper-large-v3',
};

export function hasApiKey(): boolean {
  return config.apiKey.trim().length > 0;
}
