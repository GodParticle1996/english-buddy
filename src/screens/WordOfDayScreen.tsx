// Daily word — cached per day, shown as a full card.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { WordEntry } from '../types';
import { getWordOfDayEntry } from '../services/wordOfDay';
import { isSaved, saveWord, removeWord } from '../storage/store';
import { hasAnyProvider } from '../services/providers';
import WordCardView from '../components/WordCardView';
import { colors, radius, spacing } from '../theme';

export default function WordOfDayScreen() {
  const [entry, setEntry] = useState<WordEntry | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!hasAnyProvider()) {
      setError('No API key configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getWordOfDayEntry()
      .then(async (e) => {
        setEntry(e);
        setSaved(await isSaved(e.word));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!entry) load();
    }, [entry, load])
  );

  async function toggleSave() {
    if (!entry) return;
    if (saved) {
      await removeWord(entry.word);
      setSaved(false);
    } else {
      await saveWord(entry);
      setSaved(true);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Word of the day</Text>
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      )}
      {!loading && error && (
        <View style={styles.center}>
          <Text style={styles.error}>⚠️ {error}</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}
      {!loading && !error && entry && (
        <WordCardView entry={entry} saved={saved} onToggleSave={toggleSave} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', padding: spacing.lg, paddingBottom: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  error: { color: colors.red, fontSize: 16, textAlign: 'center' },
  retry: {
    marginTop: spacing.lg,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryText: { color: colors.text, fontWeight: '600' },
});
