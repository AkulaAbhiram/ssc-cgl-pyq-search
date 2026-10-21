import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { Card, Screen, text } from '@/components/ui';
import { meta } from '@/data/store';
import { APK_PATH, SITE_NAME, SITE_URL } from '@/config';
import { colors } from '@/theme';

export const generateMetadata: GenerateMetadataFunction = async () => ({
  title: `Download the SSC CGL PYQ app for Android (free) | ${SITE_NAME}`,
  description: `Free Android app: search ${meta.count} SSC CGL previous year questions offline, with answers from SSC's official key.`,
  alternates: { canonical: `${SITE_URL}/download` },
});

// The app is not on the Play Store yet, so Android users install the APK
// directly. These steps cover the "install unknown apps" prompt.
export default function Download() {
  return (
    <Screen>
      <Text style={text.h1} accessibilityRole="header">
        Get the Android app
      </Text>
      <Text style={[text.muted, styles.sub]}>
        Search all {meta.count.toLocaleString('en-IN')} questions offline, on any Android phone. Free, no sign-up.
      </Text>

      <Link href={APK_PATH as never} style={styles.button}>
        Download APK
      </Link>

      <Text style={text.h2}>How to install</Text>
      <Card>
        {[
          'Tap Download APK and open the file when it finishes.',
          'If Android asks, allow your browser to install unknown apps (Settings opens for you; switch it on and go back).',
          'Tap Install. The app appears on your home screen as "SSC CGL PYQ search".',
        ].map((step, i) => (
          <View key={i} style={styles.step}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={[text.body, styles.stepText]}>{step}</Text>
          </View>
        ))}
      </Card>
      <Text style={[text.meta, styles.note]}>
        The app isn't on the Play Store yet, which is why Android asks for permission. The app itself never asks for your
        contacts, location, camera or files.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 6, marginBottom: 18 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    textDecorationLine: 'none',
  },
  step: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  stepNum: { fontSize: 15, fontWeight: '600', color: colors.primary, width: 16 },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22 },
  note: { marginTop: 12, lineHeight: 18 },
});
