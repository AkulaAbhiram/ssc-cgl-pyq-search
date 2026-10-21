import { type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, MAX_WIDTH, sectionColors } from '@/theme';
import { PLAY_URL, SITE_NAME } from '@/config';
import { sectionLabel } from '@/data/store';

const isWeb = Platform.OS === 'web';

// Page shell: centred column, app banner and site name on web, a back button in the app.
export function Screen({ children, back = true, scroll = true }: { children: ReactNode; back?: boolean; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const inner = (
    <View style={[styles.column, !scroll && { flex: 1 }]}>
      {isWeb ? <WebHeader /> : back ? <BackButton /> : null}
      {children}
    </View>
  );
  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {isWeb && <AppBanner />}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, { flex: 1 }]}>{inner}</View>
      )}
    </View>
  );
}

function BackButton() {
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      hitSlop={12}
      style={styles.back}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Text style={styles.backText}>← Back</Text>
    </Pressable>
  );
}

function WebHeader() {
  return (
    <View style={styles.webHeader}>
      <Link href="/" style={styles.brand}>
        {SITE_NAME}
      </Link>
    </View>
  );
}

// Web only: sends visitors to the Play Store listing.
export function AppBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>Search PYQs faster in the Android app</Text>
      <Link href={PLAY_URL} target="_blank" style={styles.bannerButton}>
        Get the app
      </Link>
    </View>
  );
}

export function Tag({ section }: { section: string }) {
  const c = sectionColors[section] ?? { bg: colors.surface, fg: colors.muted };
  return (
    <View style={[styles.tag, { backgroundColor: c.bg }]}>
      <Text style={[styles.tagText, { color: c.fg }]}>{sectionLabel(section)}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: !!active }}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <View style={styles.crumbs}>
      {items.map((item, i) => (
        <Text key={i} style={styles.crumbText}>
          {i > 0 && '  ›  '}
          {item.href ? (
            <Link href={item.href as never} style={styles.crumbLink}>
              {item.label}
            </Link>
          ) : (
            item.label
          )}
        </Text>
      ))}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export const text = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '600', color: colors.text, lineHeight: 30 },
  h2: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 24, marginBottom: 8 },
  body: { fontSize: 16, color: colors.text, lineHeight: 24 },
  meta: { fontSize: 13, color: colors.faint },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  scroll: { paddingHorizontal: 16, paddingBottom: 48, alignItems: 'center' },
  column: { width: '100%', maxWidth: MAX_WIDTH },
  back: { paddingVertical: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 15, color: colors.primary, fontWeight: '500' },
  webHeader: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: 12 },
  brand: { fontSize: 16, fontWeight: '600', color: colors.primary, textDecorationLine: 'none' },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.primaryBg, paddingVertical: 8, paddingHorizontal: 16 },
  bannerText: { fontSize: 13, color: colors.primary, flexShrink: 1 },
  bannerButton: { fontSize: 13, fontWeight: '600', color: colors.onPrimary, backgroundColor: colors.primary, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6, textDecorationLine: 'none' },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  tagText: { fontSize: 12, fontWeight: '500' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.muted },
  chipTextActive: { color: colors.onPrimary },
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  crumbText: { fontSize: 13, color: colors.faint },
  crumbLink: { color: colors.primary, textDecorationLine: 'none' },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14 },
});
