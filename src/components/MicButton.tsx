// Tap to record, tap again to stop -> transcribes speech to text via Whisper.
// Works inside Expo Go (expo-audio recording + cloud transcription).
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, Alert, Animated } from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { transcribeAudio } from '../services/transcribe';
import { haptic } from '../services/haptics';
import { colors } from '../theme';

type Props = {
  onResult: (text: string) => void;
  disabled?: boolean;
};

type Phase = 'idle' | 'recording' | 'transcribing';

export default function MicButton({ onResult, disabled }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<Phase>('idle');
  const pulse = useRef(new Animated.Value(1)).current;

  // Heartbeat pulse while recording.
  useEffect(() => {
    if (phase !== 'recording') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 480, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 480, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  async function start() {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone needed', 'Please allow microphone access to use voice search.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptic.medium();
      setPhase('recording');
    } catch (e) {
      setPhase('idle');
      Alert.alert('Could not start recording', e instanceof Error ? e.message : 'Unknown error');
    }
  }

  async function stop() {
    haptic.tap();
    setPhase('transcribing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No audio captured. Try again.');
      const text = await transcribeAudio(uri);
      if (text) onResult(text);
      else Alert.alert('Nothing heard', 'I could not catch a word. Please try again.');
    } catch (e) {
      Alert.alert('Voice search failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setPhase('idle');
    }
  }

  function onPress() {
    if (phase === 'idle') start();
    else if (phase === 'recording') stop();
    // ignore taps while transcribing
  }

  const bg =
    phase === 'recording' ? colors.red : phase === 'transcribing' ? colors.cardAlt : colors.card;

  return (
    <Pressable
      style={[styles.btn, { backgroundColor: bg }]}
      onPress={onPress}
      disabled={disabled || phase === 'transcribing'}
      accessibilityLabel={phase === 'recording' ? 'Stop recording' : 'Voice search'}
    >
      {phase === 'transcribing' ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Animated.Text style={[styles.icon, { transform: [{ scale: pulse }] }]}>
          {phase === 'recording' ? '⏹' : '🎤'}
        </Animated.Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { fontSize: 22 },
});
