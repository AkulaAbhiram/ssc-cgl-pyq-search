import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { Breadcrumbs, Screen, text } from '@/components/ui';
import { QuestionRow } from '@/components/QuestionRow';
import { findTopic, meta, questionsInTopic, sectionLabel } from '@/data/store';
import { SITE_NAME, SITE_URL } from '@/config';

export async function generateStaticParams() {
  return meta.topics.map((t) => ({ section: t.section, topic: t.slug }));
}

export const generateMetadata: GenerateMetadataFunction = async (_request, params) => {
  const t = findTopic(String(params?.section), String(params?.topic));
  if (!t) return { title: SITE_NAME };
  return {
    title: `${t.label} SSC CGL PYQs (${t.count} questions with solutions) | ${SITE_NAME}`,
    description: `All ${t.count} ${t.label} questions asked in SSC CGL ${meta.firstYear}–${meta.lastYear}, Tier 1 and Tier 2, with answers and step-by-step solutions.`,
    alternates: { canonical: `${SITE_URL}/${t.section}/${t.slug}` },
  };
};

export default function TopicScreen() {
  const { section, topic } = useLocalSearchParams<{ section: string; topic: string }>();
  const t = findTopic(String(section), String(topic));
  if (!t) {
    return (
      <Screen>
        <Text style={text.body}>Topic not found.</Text>
      </Screen>
    );
  }
  const list = questionsInTopic(t.section, t.slug);

  return (
    <Screen>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: sectionLabel(t.section), href: `/${t.section}` },
          { label: t.label },
        ]}
      />
      <Text style={text.h1} accessibilityRole="header">
        {t.label} SSC CGL PYQs
      </Text>
      <Text style={[text.muted, styles.sub]}>
        {list.length} questions · newest first · with solutions
      </Text>
      {list.map((q) => (
        <QuestionRow key={q.id} q={q} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 4, marginBottom: 8 },
});
