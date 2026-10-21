import { Image, StyleSheet, Text } from 'react-native';
import { figureSources } from '@/data/figures';
import type { FigureRef } from '@/data/store';
import { colors } from '@/theme';

// w/h are the figure's printed size in points; this shows it a little larger
// than print size, which reads well on phones.
const DISPLAY_SCALE = 1.2;

export function Figure({ figure, maxWidth }: { figure: FigureRef; maxWidth?: number }) {
  const source = figureSources[figure.file];
  if (!source) return <Text style={styles.missing}>[figure missing]</Text>;
  const width = Math.min(figure.w * DISPLAY_SCALE, maxWidth ?? Infinity);
  return (
    <Image
      source={source}
      style={[styles.image, { width, aspectRatio: figure.w / figure.h }]}
      resizeMode="contain"
      accessibilityLabel="Question figure"
    />
  );
}

const styles = StyleSheet.create({
  image: { maxWidth: '100%', backgroundColor: '#ffffff' },
  missing: { fontSize: 13, color: colors.faint },
});
