import { Text } from 'react-native';
import { Link } from 'expo-router';
import { Screen, text } from '@/components/ui';
import { colors } from '@/theme';

export default function NotFound() {
  return (
    <Screen>
      <Text style={text.h1}>Page not found</Text>
      <Link href="/" style={{ marginTop: 12, fontSize: 16, color: colors.primary }}>
        Search all questions
      </Link>
    </Screen>
  );
}
