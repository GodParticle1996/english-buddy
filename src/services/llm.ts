// Chat client that tries each provider in order (TokenMix -> Groq) and falls
// back to the next one if a call fails (daily limit, quota, rate-limit, etc.).
import { providers, Provider } from './providers';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatChoice = { message?: { content?: string } };
type ChatResponse = { choices?: ChatChoice[]; error?: { message?: string } };

async function callProvider(p: Provider, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify({
      model: p.chatModel,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  const data = (await res.json()) as ChatResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Request failed (${res.status})`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from model.');
  return content;
}

export async function chatJSON(messages: ChatMessage[]): Promise<string> {
  const list = providers();
  if (list.length === 0) {
    throw new Error('No API key configured. Add a TokenMix or Groq key in your .env file.');
  }

  const errors: string[] = [];
  for (const p of list) {
    try {
      return await callProvider(p, messages);
    } catch (e) {
      // Record and fall through to the next provider.
      errors.push(`${p.name}: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }
  throw new Error(errors.join(' | '));
}
