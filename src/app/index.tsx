import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, router } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { Screen, text } from '@/components/ui';
import { meta, topicsInSection } from '@/data/store';
import { SECTIONS, SITE_NAME, SITE_URL } from '@/config';
import { colors } from '@/theme';

const EXAMPLES = ['train crossing pole', 'synonyms', 'article 21', 'profit loss', '2024 tier 1'];

export const generateMetadata: GenerateMetadataFunction = async () => ({
  title: `SSC CGL previous year questions with solutions | ${SITE_NAME}`,
  description: `Search ${meta.count} SSC CGL previous year questions (${meta.firstYear}–${meta.lastYear}) by topic, keyword or question. Tier 1 and Tier 2, with answers and solutions. Free.`,
  alternates: { canonical: SITE_URL },
});

export default function Home() {
  const [query, setQuery] = useState('');
  const go = (q: string) => router.push({ pathname: '/search', params: q ? { q } : {} });

  return (
    <Screen back={false}>
      <View style={styles.hero}>
        <Text style={[text.h1, styles.center]}>SSC CGL previous year questions, searchable</Text>
        <Text style={[text.muted, styles.center]}>
          {meta.count.toLocaleString('en-IN')} questions · {meta.firstYear}–{meta.lastYear} · with solutions
        </Text>
        {meta.sample && <Text style={styles.sample}>Sample data: real papers not loaded yet</Text>}
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => go(query)}
          onFocus={() => !query && go('')}
          placeholder="Search a topic, keyword or question"
          placeholderTextColor={colors.faint}
          returnKeyType="search"
          style={styles.input}
          accessibilityLabel="Search questions"
        />
        <View style={styles.examples}>
          {EXAMPLES.map((e) => (
            <Pressable key={e} onPress={() => go(e)} style={styles.example}>
              <Text style={styles.exampleText}>{e}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Topic links double as the crawl path to every topic page. */}
      {SECTIONS.map((s) => (
        <View key={s.slug}>
          <Link href={`/${s.slug}`} style={text.h2}>
            {s.full}
          </Link>
          <View style={styles.topics}>
            {topicsInSection(s.slug).map((t) => (
              <Link key={t.slug} href={`/${s.slug}/${t.slug}`} style={styles.topic}>
                {t.label} <Text style={text.meta}>{t.count}</Text>
              </Link>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 32, paddingBottom: 8, gap: 10 },
  center: { textAlign: 'center' },
  sample: { alignSelf: 'center', fontSize: 12, color: '#633806', backgroundColor: '#faeeda', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  input: { marginTop: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  example: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.surface },
  exampleText: { fontSize: 13, color: colors.muted },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topic: { fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, textDecorationLine: 'none' },
});
