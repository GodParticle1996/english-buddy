// Renders one WordEntry as a rich, scrollable card with staggered entrance.
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated } from 'react-native';
import { WordEntry } from '../types';
import { colors, radius, spacing, font, shadow } from '../theme';
import { speak } from '../services/speak';
import { haptic } from '../services/haptics';
import AnimatedMount from './AnimatedMount';
import PressableScale from './PressableScale';

type Props = {
  entry: WordEntry;
  saved: boolean;
  onToggleSave: () => void;
  onLookupWord?: (word: string) => void;
};

function Section({
  title,
  icon,
  delay,
  accent = colors.accent,
  children,
}: {
  title: string;
  icon: string;
  delay: number;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatedMount delay={delay} style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={[styles.sectionTitle, { color: accent }]}>{title}</Text>
      </View>
      {children}
    </AnimatedMount>
  );
}

function speakIt(text: string) {
  haptic.tap();
  speak(text);
}

export default function WordCardView({ entry, saved, onToggleSave, onLookupWord }: Props) {
  const pos = entry.meanings.map((m) => m.partOfSpeech).filter(Boolean);

  // Pop the star whenever it becomes saved.
  const star = useRef(new Animated.Value(1)).current;
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (saved) {
      Animated.sequence([
        Animated.spring(star, { toValue: 1.4, useNativeDriver: true, speed: 50, bounciness: 12 }),
        Animated.spring(star, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }),
      ]).start();
    }
  }, [saved, star]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <AnimatedMount delay={0} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.word} numberOfLines={2}>
            {entry.word}
          </Text>
          <Pressable
            onPress={() => {
              saved ? haptic.tap() : haptic.success();
              onToggleSave();
            }}
            hitSlop={8}
          >
            <Animated.View
              style={[
                styles.saveBtn,
                saved && styles.saveBtnOn,
                { transform: [{ scale: star }] },
              ]}
            >
              <Text style={[styles.saveIcon, saved && styles.saveIconOn]}>
                {saved ? '★' : '☆'}
              </Text>
            </Animated.View>
          </Pressable>
        </View>

        <Pressable style={styles.pronRow} onPress={() => speakIt(entry.word)} hitSlop={8}>
          <Text style={styles.speakerPill}>🔊</Text>
          {!!entry.phonetic && <Text style={styles.phonetic}>{entry.phonetic}</Text>}
          <Text style={styles.tapToHear}>tap to hear</Text>
        </Pressable>

        {pos.length > 0 && (
          <View style={styles.posRow}>
            {[...new Set(pos)].map((p) => (
              <View key={p} style={styles.posBadge}>
                <Text style={styles.posBadgeText}>{p}</Text>
              </View>
            ))}
          </View>
        )}
      </AnimatedMount>

      {/* Meanings */}
      <Section title="Meaning" icon="📖" delay={70}>
        {entry.meanings.map((m, i) => (
          <View key={i} style={[styles.meaningBlock, i > 0 && styles.meaningDivider]}>
            <Text style={styles.definition}>{m.definition}</Text>
            {!!m.example && (
              <Pressable style={styles.exampleRow} onPress={() => speakIt(m.example)}>
                <Text style={styles.exampleSpeaker}>🔊</Text>
                <Text style={styles.example}>{m.example}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </Section>

      {entry.synonyms.length > 0 && (
        <Section title="Synonyms" icon="🔁" accent={colors.green} delay={130}>
          <View style={styles.chipWrap}>
            {entry.synonyms.map((s, i) => (
              <PressableScale
                key={`${s}-${i}`}
                style={styles.chip}
                onPress={() => {
                  if (onLookupWord) {
                    haptic.tap();
                    onLookupWord(s);
                  }
                }}
              >
                <Text style={styles.chipText}>{s}</Text>
                {onLookupWord && <Text style={styles.chipArrow}>↗</Text>}
              </PressableScale>
            ))}
          </View>
        </Section>
      )}

      {entry.antonyms.length > 0 && (
        <Section title="Antonyms" icon="⛔" accent={colors.red} delay={180}>
          <View style={styles.chipWrap}>
            {entry.antonyms.map((s, i) => (
              <View key={`${s}-${i}`} style={[styles.chip, styles.chipMuted]}>
                <Text style={styles.chipText}>{s}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}

      {entry.genz.length > 0 && (
        <Section title="Gen-Z / casual" icon="💬" accent={colors.yellow} delay={230}>
          {entry.genz.map((g, i) => (
            <Pressable key={i} style={styles.genzRow} onPress={() => speakIt(g)}>
              <Text style={styles.genzText}>{g}</Text>
            </Pressable>
          ))}
        </Section>
      )}

      {/* Bengali */}
      <AnimatedMount delay={290} style={[styles.glossCard, { borderLeftColor: colors.bengali }]}>
        <Text style={[styles.glossLabel, { color: colors.bengali }]}>BENGALI</Text>
        <Text style={styles.glossMeaning}>{entry.bengali.meaning_latin}</Text>
        {!!entry.bengali.example_latin && (
          <Text style={styles.glossExample}>{entry.bengali.example_latin}</Text>
        )}
      </AnimatedMount>

      {/* Hindi */}
      <AnimatedMount delay={340} style={[styles.glossCard, { borderLeftColor: colors.hindi }]}>
        <Text style={[styles.glossLabel, { color: colors.hindi }]}>HINDI</Text>
        <Text style={styles.glossMeaning}>{entry.hindi.meaning_latin}</Text>
        {!!entry.hindi.example_latin && (
          <Text style={styles.glossExample}>{entry.hindi.example_latin}</Text>
        )}
      </AnimatedMount>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.sm },

  header: { marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  word: { ...font.h1, color: colors.text, flex: 1 },
  saveBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtnOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  saveIcon: { fontSize: 22, color: colors.textDim },
  saveIconOn: { color: colors.accent },

  pronRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  speakerPill: { fontSize: 16, marginRight: spacing.sm },
  phonetic: { color: colors.accent, fontSize: 16 },
  tapToHear: { color: colors.textFaint, fontSize: 12, marginLeft: spacing.sm },

  posRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  posBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  posBadgeText: { color: colors.accent, fontSize: 12, fontWeight: '700', fontStyle: 'italic' },

  section: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  sectionIcon: { fontSize: 14, marginRight: spacing.sm },
  sectionTitle: { ...font.label },

  meaningBlock: { marginBottom: spacing.xs },
  meaningDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  definition: { ...font.body, color: colors.text, fontSize: 17 },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: colors.bgElev,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  exampleSpeaker: { fontSize: 13, marginRight: spacing.sm, marginTop: 2 },
  example: { flex: 1, color: colors.textDim, fontSize: 15, fontStyle: 'italic', lineHeight: 21 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  chipMuted: { backgroundColor: colors.cardAlt },
  chipText: { color: colors.text, fontSize: 14 },
  chipArrow: { color: colors.accent, fontSize: 12, marginLeft: 5, fontWeight: '700' },

  genzRow: {
    backgroundColor: colors.bgElev,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  genzText: { color: colors.text, fontSize: 15, lineHeight: 22 },

  glossCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderLeftWidth: 4,
    ...shadow,
  },
  glossLabel: { ...font.label, marginBottom: spacing.sm },
  glossMeaning: { color: colors.text, fontSize: 17, lineHeight: 24 },
  glossExample: { color: colors.textDim, fontSize: 15, marginTop: 6, fontStyle: 'italic' },
});
