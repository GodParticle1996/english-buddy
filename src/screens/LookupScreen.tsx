// Main screen: search box + result card. Accepts English / Bengali / Hindi input.
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { WordEntry, HistoryItem } from '../types';
import { lookupCached } from '../services/cache';
import { addHistory, getHistory, isSaved, removeWord, saveWord } from '../storage/store';
import { hasAnyProvider } from '../services/providers';
import { haptic } from '../services/haptics';
import WordCardView from '../components/WordCardView';
import MicButton from '../components/MicButton';
import Skeleton from '../components/Skeleton';
import AnimatedMount from '../components/AnimatedMount';
import PressableScale from '../components/PressableScale';
import { colors, radius, spacing, font } from '../theme';

export default function LookupScreen() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<WordEntry | null>(null);
  const [saved, setSaved] = useState(false);
  const [recent, setRecent] = useState<HistoryItem[]>([]);

  const loadRecent = useCallback(() => {
    getHistory().then((h) => setRecent(h.slice(0, 8)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecent();
    }, [loadRecent])
  );

  async function onSearch(override?: string) {
    const q = (override ?? query).trim();
    if (!q) return;
    Keyboard.dismiss();
    if (!hasAnyProvider()) {
      setError('No API key configured. Add a TokenMix or Groq key to your .env file.');
      return;
    }
    setQuery(q);
    setLoading(true);
    setError(null);
    setEntry(null);
    try {
      const result = await lookupCached(q);
      haptic.light();
      setEntry(result);
      setSaved(await isSaved(result.word));
      await addHistory(q, result.word);
      loadRecent();
    } catch (e) {
      haptic.warning();
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.searchRow}>
          <View style={styles.inputWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.input}
              placeholder="English, Bengali or Hindi…"
              placeholderTextColor={colors.textFaint}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => onSearch()}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable hitSlop={10} onPress={() => setQuery('')}>
                <Text style={styles.clearIcon}>✕</Text>
              </Pressable>
            )}
          </View>
          <MicButton
            disabled={loading}
            onResult={(text) => {
              setQuery(text);
              onSearch(text);
            }}
          />
        </View>

        {loading && <Skeleton />}

        {!loading && error && (
          <AnimatedMount style={styles.center}>
            <Text style={styles.emoji}>😕</Text>
            <Text style={styles.error}>{error}</Text>
            <PressableScale style={styles.retryBtn} onPress={() => onSearch()}>
              <Text style={styles.retryText}>Try again</Text>
            </PressableScale>
          </AnimatedMount>
        )}

        {!loading && !error && !entry && (
          <View style={styles.empty}>
            <AnimatedMount delay={40} style={styles.emptyHead}>
              <Text style={styles.emoji}>📖</Text>
              <Text style={styles.emptyTitle}>Look up any word</Text>
              <Text style={styles.dim}>
                Meaning, examples, synonyms, Gen-Z usage{'\n'}and Bengali / Hindi — typed or spoken.
              </Text>
            </AnimatedMount>

            {recent.length > 0 && (
              <AnimatedMount delay={160} style={styles.recentWrap}>
                <Text style={styles.recentLabel}>RECENT</Text>
                <View style={styles.recentChips}>
                  {recent.map((r, i) => (
                    <PressableScale
                      key={`${r.word}-${i}`}
                      style={styles.recentChip}
                      onPress={() => {
                        haptic.tap();
                        onSearch(r.word);
                      }}
                    >
                      <Text style={styles.recentChipText}>{r.word}</Text>
                    </PressableScale>
                  ))}
                </View>
              </AnimatedMount>
            )}
          </View>
        )}

        {!loading && !error && entry && (
          <WordCardView
            key={entry.word}
            entry={entry}
            saved={saved}
            onToggleSave={toggleSave}
            onLookupWord={(w) => onSearch(w)}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  searchRow: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { fontSize: 15, marginRight: spacing.sm },
  input: { flex: 1, paddingVertical: spacing.md, color: colors.text, fontSize: 16 },
  clearIcon: { color: colors.textFaint, fontSize: 15, paddingHorizontal: 4 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  empty: { flex: 1, alignItems: 'center', paddingTop: 64, paddingHorizontal: spacing.xl },
  emptyHead: { alignItems: 'center' },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { ...font.h2, color: colors.text, marginBottom: spacing.sm },
  dim: { color: colors.textDim, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  recentWrap: { marginTop: spacing.xxl, width: '100%', alignItems: 'center' },
  recentLabel: { ...font.label, color: colors.textFaint, marginBottom: spacing.md },
  recentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  recentChip: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentChipText: { color: colors.text, fontSize: 14 },

  error: { color: colors.text, fontSize: 16, textAlign: 'center', lineHeight: 23 },
  retryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
