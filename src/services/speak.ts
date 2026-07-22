// Text-to-speech pronunciation via expo-speech (on-device, free, no API).
import * as Speech from 'expo-speech';

export function speak(text: string): void {
  Speech.stop();
  Speech.speak(text, { language: 'en-US', rate: 0.9 });
}
