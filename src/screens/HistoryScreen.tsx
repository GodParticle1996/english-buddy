// Search history; tap an item to re-open its card (re-fetches from the model).
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { HistoryItem, WordEntry } from '../types';
import { getHistory, clearHistory, isSaved, saveWord, removeWord } from '../storage/store';
import { lookupCached } from '../services/cache';
import WordCardView from '../components/WordCardView';
import { colors, radius, spacing } from '../theme';

export default function HistoryScreen() {
  const [list, setList] = useState<HistoryItem[]>([]);
  const [entry, setEntry] = useState<WordEntry | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    getHistory().then(setList);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function open(word: string) {
    setLoading(true);
    try {
      const result = await lookupCached(word);
      setEntry(result);
      setSaved(await isSaved(result.word));
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (entry) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Pressable style={styles.backRow} onPress={() => setEntry(null)}>
          <Text style={styles.backText}>‹ History</Text>
        </Pressable>
        <WordCardView entry={entry} saved={saved} onToggleSave={toggleSave} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        {list.length > 0 && (
          <Pressable onPress={() => clearHistory().then(refresh)}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        data={list}
        keyExtractor={(item, i) => `${item.word}-${i}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🕘</Text>
            <Text style={styles.dim}>No lookups yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => open(item.word)}>
            <Text style={styles.rowWord}>{item.word}</Text>
            {item.query.toLowerCase() !== item.word.toLowerCase() && (
              <Text style={styles.rowSub}>searched: {item.query}</Text>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  clear: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowWord: { color: colors.text, fontSize: 17, fontWeight: '600' },
  rowSub: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  backRow: { padding: spacing.lg, paddingBottom: spacing.sm },
  backText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48 },
  dim: { color: colors.textDim, fontSize: 15, textAlign: 'center', marginTop: spacing.md },
});
