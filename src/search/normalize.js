// Text normalization shared by the index builder (Node) and the app, so
// documents and queries are reduced to the same terms. Plain JS on purpose.
import { stemmer } from 'stemmer';

export const STOPWORDS = new Set(
  ('a an the is are was were be been being am of in on at to for from by with as and or ' +
    'but not no nor if then than that this these those it its into over under about ' +
    'which what who whom whose when where why how find select given following ' +
    'option options choose most appropriate do does did can could ' +
    'will would shall should may might must has have had he she they we you i his her ' +
    'their our your each per same').split(' ')
);

// "twoSum" -> "two Sum", "240m" -> "240 m", then lowercase and split on non-alphanumerics.
export function tokenize(text) {
  return String(text)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Numbers stay as written; words are stemmed ("crossing", "crosses" -> "cross").
export function normalizeToken(token) {
  return /^\d/.test(token) ? token : stemmer(token);
}

export function analyze(text) {
  const out = [];
  for (const t of tokenize(text)) {
    if (STOPWORDS.has(t)) continue;
    out.push(normalizeToken(t));
  }
  return out;
}

// URL slug from the meaningful words: "Select the most appropriate synonym of
// the given word: ABUNDANT" -> "synonym-abundant".
export function slugify(text, maxWords = 8) {
  const words = tokenize(text).filter((t) => !STOPWORDS.has(t) && (t.length > 1 || /\d/.test(t)));
  return (words.length ? words : tokenize(text)).slice(0, maxWords).join('-');
}
