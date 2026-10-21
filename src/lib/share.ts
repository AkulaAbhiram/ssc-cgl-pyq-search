import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SITE_URL } from '@/config';
import { paperLabel, type Question } from '@/data/store';

export const questionUrl = (q: Question) => `${SITE_URL}/q/${q.slug}`;

// Shares a question as text plus a link to its web page, so anyone without the
// app still lands on the question. Returns 'copied' when the web fallback
// copied the link instead of opening a share sheet.
export async function shareQuestion(q: Question): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = questionUrl(q);
  const text = `${q.q}\n\nSSC CGL ${paperLabel(q)}\nAnswer and solution: ${url}`;

  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title: 'SSC CGL PYQ', text: `${q.q}\n\nSSC CGL ${paperLabel(q)}`, url });
        return 'shared';
      } catch {
        return 'cancelled';
      }
    }
    await Clipboard.setStringAsync(url);
    return 'copied';
  }

  // Android shows only `message`, so the link goes inside it.
  const result = await Share.share({ message: text, url, title: 'SSC CGL PYQ' });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
}
