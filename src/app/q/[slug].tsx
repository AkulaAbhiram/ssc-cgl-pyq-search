import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { Breadcrumbs, Card, Screen, Tag, text } from '@/components/ui';
import { QuestionRow } from '@/components/QuestionRow';
import { JsonLd } from '@/components/JsonLd';
import { Figure } from '@/components/Figure';
import {
  neighbours,
  paperLabel,
  questionBySlug,
  questions,
  questionsInTopic,
  sectionLabel,
  type Question,
} from '@/data/store';
import { questionUrl, shareQuestion } from '@/lib/share';
import { SITE_NAME, SITE_URL } from '@/config';
import { colors } from '@/theme';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export async function generateStaticParams() {
  return questions.map((q) => ({ slug: q.slug }));
}

export const generateMetadata: GenerateMetadataFunction = async (_request, params) => {
  const q = questionBySlug(String(params?.slug));
  if (!q) return { title: SITE_NAME };
  const name = q.q || `${q.topic} figure question`;
  const title = `${name.length > 70 ? `${name.slice(0, 67)}…` : name} | SSC CGL ${q.year} PYQ`;
  const answer = q.answer === null ? '' : ` Answer: ${q.options[q.answer]}.`;
  const description = `SSC CGL ${paperLabel(q)} ${q.topic} question.${answer} ${q.solution}`.trim().slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: questionUrl(q) },
    openGraph: { title, description, url: questionUrl(q), siteName: SITE_NAME, type: 'article' },
  };
};

export default function QuestionScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = questionBySlug(String(slug));
  const [shareNote, setShareNote] = useState('');

  if (!q) {
    return (
      <Screen>
        <Text style={text.body}>This question isn't in the bank anymore.</Text>
      </Screen>
    );
  }

  const { prev, next } = neighbours(q.id);
  const related = questionsInTopic(q.section, q.topicSlug).filter((r) => r.id !== q.id).slice(0, 5);

  const onShare = async () => {
    const result = await shareQuestion(q);
    if (result === 'copied') {
      setShareNote('Link copied');
      setTimeout(() => setShareNote(''), 2000);
    }
  };

  return (
    <Screen>
      <JsonLd data={structuredData(q)} />
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: sectionLabel(q.section), href: `/${q.section}` },
          { label: q.topic, href: `/${q.section}/${q.topicSlug}` },
        ]}
      />

      <View style={styles.metaRow}>
        <Tag section={q.section} />
        <Text style={text.meta}>SSC CGL {paperLabel(q)}</Text>
      </View>

      {!!q.q && (
        <Text style={[text.body, styles.question]} accessibilityRole="header">
          {q.q}
        </Text>
      )}
      {q.figures.map((f) => (
        <View key={f.file} style={styles.figure}>
          <Figure figure={f} />
        </View>
      ))}

      {q.options.map((opt, i) => {
        const correct = i === q.answer;
        const fig = q.optionFigures[String(i)];
        return (
          <View key={i} style={[styles.option, correct && styles.correct]}>
            <Text style={[styles.letter, correct && styles.correctText]}>{LETTERS[i]}</Text>
            <View style={styles.optionBody}>
              {!!opt && <Text style={[styles.optionText, correct && styles.correctText]}>{opt}</Text>}
              {fig && <Figure figure={fig} maxWidth={260} />}
            </View>
            {correct && <Text style={[styles.correctText, styles.tick]}>✓ Answer</Text>}
          </View>
        );
      })}

      <Text style={[text.meta, styles.answerNote]}>
        {q.answer === null
          ? 'Answer not confirmed yet'
          : q.answerSource === 'ssc-key'
            ? "Answer from SSC's official answer key"
            : null}
      </Text>

      {!!q.solution && (
        <Card style={styles.solution}>
          <Text style={styles.solutionTitle}>Solution</Text>
          <Text style={text.muted}>{q.solution}</Text>
        </Card>
      )}

      <View style={styles.actions}>
        <Pressable onPress={onShare} style={styles.shareButton} accessibilityRole="button">
          <Text style={styles.shareText}>Share question</Text>
        </Pressable>
        {!!shareNote && <Text style={text.meta}>{shareNote}</Text>}
      </View>

      {(prev || next) && (
        <View style={styles.stepper}>
          <Pressable disabled={!prev} onPress={() => prev && router.replace(`/q/${prev.slug}`)} hitSlop={8}>
            <Text style={[styles.step, !prev && styles.stepOff]}>← Previous</Text>
          </Pressable>
          <Pressable disabled={!next} onPress={() => next && router.replace(`/q/${next.slug}`)} hitSlop={8}>
            <Text style={[styles.step, !next && styles.stepOff]}>Next →</Text>
          </Pressable>
        </View>
      )}

      {related.length > 0 && (
        <>
          <Text style={text.h2}>More {q.topic} questions</Text>
          {related.map((r) => (
            <QuestionRow key={r.id} q={r} />
          ))}
          <Link href={`/${q.section}/${q.topicSlug}`} style={styles.allLink}>
            All {q.topic} PYQs →
          </Link>
        </>
      )}
    </Screen>
  );
}

// schema.org Quiz markup (Google's education Q&A format) plus breadcrumbs.
// The Quiz needs an accepted answer, so unanswered questions get breadcrumbs only.
function structuredData(q: Question) {
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: sectionLabel(q.section), item: `${SITE_URL}/${q.section}` },
      { '@type': 'ListItem', position: 3, name: q.topic, item: `${SITE_URL}/${q.section}/${q.topicSlug}` },
    ],
  };
  if (q.answer === null) return [breadcrumbs];
  const answer = q.answer;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Quiz',
      name: `SSC CGL ${q.year} ${q.topic} question`,
      about: { '@type': 'Thing', name: q.topic },
      educationalLevel: 'SSC CGL',
      hasPart: [
        {
          '@type': 'Question',
          eduQuestionType: 'Multiple choice',
          text: q.q,
          suggestedAnswer: q.options
            .filter((_, i) => i !== answer)
            .map((o) => ({ '@type': 'Answer', text: o })),
          acceptedAnswer: {
            '@type': 'Answer',
            text: q.options[answer],
            ...(q.solution ? { answerExplanation: { '@type': 'Comment', text: q.solution } } : {}),
          },
        },
      ],
    },
    breadcrumbs,
  ];
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  question: { fontSize: 17, lineHeight: 26, marginVertical: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
  correct: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  letter: { fontSize: 14, fontWeight: '600', color: colors.muted, width: 16 },
  optionBody: { flex: 1, gap: 6 },
  optionText: { fontSize: 15, color: colors.text },
  figure: { marginBottom: 12, alignItems: 'flex-start' },
  correctText: { color: colors.success },
  tick: { fontSize: 13, fontWeight: '600' },
  answerNote: { marginTop: 2, marginBottom: 6 },
  solution: { marginTop: 6 },
  solutionTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  shareButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  shareText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  step: { fontSize: 15, color: colors.primary, fontWeight: '500' },
  stepOff: { color: colors.border },
  allLink: { marginTop: 12, fontSize: 14, color: colors.primary, textDecorationLine: 'none' },
});
