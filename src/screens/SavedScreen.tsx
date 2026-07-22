// List of saved words; tap to open the full card, swipe-free delete via button.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { SavedWord } from '../types';
import { getSaved, removeWord } from '../storage/store';
import WordCardView from '../components/WordCardView';
import { colors, radius, spacing } from '../theme';

export default function SavedScreen() {
  const [list, setList] = useState<SavedWord[]>([]);
  const [selected, setSelected] = useState<SavedWord | null>(null);

  const refresh = useCallback(() => {
    getSaved().then(setList);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function onRemove(word: string) {
    const next = await removeWord(word);
    setList(next);
    if (selected && selected.entry.word.toLowerCase() === word.toLowerCase()) {
      setSelected(null);
    }
  }

  if (selected) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Pressable style={styles.backRow} onPress={() => setSelected(null)}>
          <Text style={styles.backText}>‹ Saved words</Text>
        </Pressable>
        <WordCardView
          entry={selected.entry}
          saved
          onToggleSave={() => onRemove(selected.entry.word)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Saved words</Text>
      <FlatList
        data={list}
        keyExtractor={(item) => item.entry.word}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>⭐</Text>
            <Text style={styles.dim}>No saved words yet. Tap the ☆ on any word.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => setSelected(item)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowWord}>{item.entry.word}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {item.entry.meanings[0]?.definition ?? ''}
              </Text>
            </View>
            <Pressable hitSlop={10} onPress={() => onRemove(item.entry.word)}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', padding: spacing.lg },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowWord: { color: colors.text, fontSize: 18, fontWeight: '700' },
  rowSub: { color: colors.textDim, fontSize: 14, marginTop: 2 },
  remove: { color: colors.textDim, fontSize: 18, paddingLeft: spacing.md },
  backRow: { padding: spacing.lg, paddingBottom: spacing.sm },
  backText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48 },
  dim: { color: colors.textDim, fontSize: 15, textAlign: 'center', marginTop: spacing.md },
});
