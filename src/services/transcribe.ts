// Speech-to-text: uploads recorded audio to an OpenAI-compatible
// /audio/transcriptions endpoint (Whisper). Tries each provider in order
// (TokenMix -> Groq) and falls back if one fails.
import { providers, Provider } from './providers';

type TranscribeResponse = { text?: string; error?: { message?: string } };

async function callProvider(p: Provider, uri: string): Promise<string> {
  const form = new FormData();
  // React Native FormData file shape: { uri, name, type }.
  form.append('file', {
    uri,
    name: 'speech.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);
  form.append('model', p.transcribeModel);
  form.append('language', 'en'); // bias toward English vocabulary words

  const res = await fetch(`${p.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    // NOTE: do NOT set Content-Type — fetch adds the multipart boundary itself.
    headers: { Authorization: `Bearer ${p.apiKey}` },
    body: form,
  });

  const data = (await res.json()) as TranscribeResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Transcription failed (${res.status})`);
  }
  // Whisper sometimes adds trailing punctuation; trim it for clean lookups.
  return (data.text ?? '').trim().replace(/[.?!,]+$/, '').trim();
}

export async function transcribeAudio(uri: string): Promise<string> {
  const list = providers();
  if (list.length === 0) {
    throw new Error('No API key configured. Add a TokenMix or Groq key in your .env file.');
  }

  const errors: string[] = [];
  for (const p of list) {
    try {
      return await callProvider(p, uri);
    } catch (e) {
      errors.push(`${p.name}: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }
  throw new Error(errors.join(' | '));
}
