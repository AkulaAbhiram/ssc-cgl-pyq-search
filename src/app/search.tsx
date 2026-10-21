import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { Chip, Screen, text } from '@/components/ui';
import { QuestionRow } from '@/components/QuestionRow';
import { questions, search, setLastResults } from '@/data/store';
import { SECTIONS, SITE_NAME } from '@/config';
import { colors } from '@/theme';

const DEBOUNCE_MS = 150;

// Result pages are endless query variations: keep them out of Google's index
// and let the topic and question pages rank instead.
export const generateMetadata: GenerateMetadataFunction = async () => ({
  title: `Search SSC CGL PYQs | ${SITE_NAME}`,
  robots: { index: false, follow: true },
});

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; section?: string }>();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Read the URL after mount: the static HTML was rendered with no query, and
  // starting from it on the first render would mismatch on hydration.
  useEffect(() => {
    setInput(params.q ?? '');
    setQuery(params.q ?? '');
    setSection(params.section ?? null);
    setReady(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQuery(input), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  // Keep the URL in step so a web search can be bookmarked or shared.
  useEffect(() => {
    if (ready) router.setParams({ q: query || undefined, section: section || undefined });
  }, [query, section, ready]);

  const out = useMemo(() => search(query, { section, typing: true }), [query, section]);
  useEffect(() => setLastResults(out.results.map((r) => r.id)), [out]);

  const toggle = (slug: string) => setSection((s) => (s === slug ? null : slug));
  const n = out.results.length;

  return (
    <Screen scroll={false}>
      <TextInput
        value={input}
        onChangeText={setInput}
        autoFocus
        placeholder="Search a topic, keyword or question"
        placeholderTextColor={colors.faint}
        returnKeyType="search"
        style={styles.input}
        accessibilityLabel="Search questions"
        clearButtonMode="while-editing"
      />
      <View style={styles.chips}>
        <Chip label="All" active={!section} onPress={() => setSection(null)} />
        {SECTIONS.map((s) => (
          <Chip key={s.slug} label={s.label} active={section === s.slug} onPress={() => toggle(s.slug)} />
        ))}
      </View>

      <FlatList
        data={out.results}
        keyExtractor={(r) => String(r.id)}
        renderItem={({ item }) => <QuestionRow q={questions[item.id]} terms={out.terms} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={15}
        ListHeaderComponent={
          query.trim() || section ? (
            <Text style={[text.meta, styles.count]}>
              {n === 0 ? '' : `${n}${n === 200 ? '+' : ''} question${n === 1 ? '' : 's'}`}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          <Text style={[text.muted, styles.empty]}>
            {query.trim() || section
              ? 'No questions match. Try fewer words or a different spelling.'
              : 'Type a topic like "percentage", a word like "synonyms", or paste a question. Add a year or "tier 2" to narrow it down.'}
          </Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  count: { marginBottom: 6 },
  empty: { paddingVertical: 24 },
});
