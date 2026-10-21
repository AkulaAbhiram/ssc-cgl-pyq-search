import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { highlightParts } from '@/search/engine';
import { hasFigures, paperLabel, type Question } from '@/data/store';
import { colors } from '@/theme';
import { Tag } from './ui';

// One result line: section tag, paper, and the question with matched words highlighted.
export function QuestionRow({ q, terms }: { q: Question; terms?: Map<string, number> }) {
  return (
    <Link href={`/q/${q.slug}`} asChild>
      <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.metaRow}>
          <Tag section={q.section} />
          <Text style={styles.meta}>
            {paperLabel(q)}
            {hasFigures(q) ? ' · has figure' : ''}
          </Text>
        </View>
        <Highlight text={q.q || `${q.topic}: figure-based question`} terms={terms} numberOfLines={3} />
      </Pressable>
    </Link>
  );
}

export function Highlight({ text, terms, numberOfLines }: { text: string; terms?: Map<string, number>; numberOfLines?: number }) {
  const parts: { text: string; hit: boolean }[] = highlightParts(text, terms);
  return (
    <Text style={styles.text} numberOfLines={numberOfLines}>
      {parts.map((p, i) =>
        p.hit ? (
          <Text key={i} style={styles.hit}>
            {p.text}
          </Text>
        ) : (
          p.text
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 6 },
  pressed: { backgroundColor: colors.surface },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontSize: 12, color: colors.faint },
  text: { fontSize: 15, lineHeight: 22, color: colors.text },
  hit: { backgroundColor: colors.highlight },
});
