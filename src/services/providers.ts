// Ordered list of LLM providers. We try them in order and fall back to the
// next one if a call fails (e.g. TokenMix daily limit / quota exceeded).
import { config } from '../config';

export type Provider = {
  name: string;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  transcribeModel: string;
};

export function providers(): Provider[] {
  const list: Provider[] = [];
  // 1) TokenMix (primary)
  if (config.apiKey.trim()) {
    list.push({
      name: 'TokenMix',
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      chatModel: config.model,
      transcribeModel: config.transcribeModel,
    });
  }
  // 2) Groq (fallback)
  if (config.groqApiKey.trim()) {
    list.push({
      name: 'Groq',
      baseUrl: config.groqBaseUrl,
      apiKey: config.groqApiKey,
      chatModel: config.groqModel,
      transcribeModel: config.groqTranscribeModel,
    });
  }
  return list;
}

export function hasAnyProvider(): boolean {
  return providers().length > 0;
}
