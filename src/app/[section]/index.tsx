import { StyleSheet, Text } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { Breadcrumbs, Screen, text } from '@/components/ui';
import { meta, topicsInSection } from '@/data/store';
import { SECTIONS, SITE_NAME, SITE_URL, sectionBySlug } from '@/config';
import { colors } from '@/theme';

export async function generateStaticParams() {
  return SECTIONS.map((s) => ({ section: s.slug }));
}

export const generateMetadata: GenerateMetadataFunction = async (_request, params) => {
  const s = sectionBySlug(String(params?.section));
  if (!s) return { title: SITE_NAME };
  return {
    title: `SSC CGL ${s.full} previous year questions, topic-wise | ${SITE_NAME}`,
    description: `Topic-wise SSC CGL ${s.full} PYQs from ${meta.firstYear}–${meta.lastYear}, with answers and solutions.`,
    alternates: { canonical: `${SITE_URL}/${s.slug}` },
  };
};

export default function SectionScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const s = sectionBySlug(String(section));
  if (!s) {
    return (
      <Screen>
        <Text style={text.body}>Section not found.</Text>
      </Screen>
    );
  }
  const topics = topicsInSection(s.slug);
  const total = topics.reduce((n, t) => n + t.count, 0);

  return (
    <Screen>
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: s.label }]} />
      <Text style={text.h1} accessibilityRole="header">
        SSC CGL {s.full} PYQs
      </Text>
      <Text style={[text.muted, styles.sub]}>
        {total} questions across {topics.length} topics
      </Text>
      {topics.map((t) => (
        <Link key={t.slug} href={`/${s.slug}/${t.slug}`} style={styles.row}>
          {t.label}
          <Text style={text.meta}>{'  '}{t.count} questions</Text>
        </Link>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 4, marginBottom: 12 },
  row: { fontSize: 16, color: colors.text, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, textDecorationLine: 'none' },
});
