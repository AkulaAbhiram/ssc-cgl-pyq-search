// BM25 search over the prebuilt inverted index (scripts/build-index.mjs).
// Same idea as DSA-Searchify's app.js, but only the documents that contain a
// query term are scored, instead of every document on every query.
import { tokenize, normalizeToken, STOPWORDS } from './normalize.js';

const K1 = 1.2;
const B = 0.75;
const PREFIX_WEIGHT = 0.6;
const SPELL_WEIGHT = 0.8;
const MAX_PREFIX_EXPANSIONS = 8;

const SECTION_WORDS = {
  quant: 'quant', maths: 'quant', math: 'quant', aptitude: 'quant',
  reasoning: 'reasoning',
  english: 'english',
  ga: 'ga', gk: 'ga', gs: 'ga',
};

export function createEngine(index, docs) {
  const { N, avgdl, len, postings } = index;
  const vocab = Object.keys(postings).sort();
  const idf = {};
  for (const term of vocab) {
    const df = postings[term].length / 2;
    idf[term] = Math.log(1 + (N - df + 0.5) / (df + 0.5));
  }

  // Spelling: every vocab term and its one-letter deletions, built on first use.
  let deletes = null;
  const buildDeletes = () => {
    deletes = new Map();
    const add = (key, term) => {
      const list = deletes.get(key);
      if (list) list.push(term);
      else deletes.set(key, [term]);
    };
    for (const term of vocab) {
      if (/^\d/.test(term)) continue;
      add(term, term);
      for (const d of oneDeletes(term)) add(d, term);
    }
  };

  const correct = (token) => {
    if (token.length < 4 || /^\d/.test(token)) return null;
    if (!deletes) buildDeletes();
    const candidates = new Set();
    for (const key of [token, ...oneDeletes(token)]) {
      for (const term of deletes.get(key) || []) candidates.add(term);
    }
    let best = null;
    for (const term of candidates) {
      if (editDistance(token, term) > 2) continue;
      // Most common term wins ties: it is the likelier intent.
      if (!best || postings[term].length > postings[best].length) best = term;
    }
    return best;
  };

  const withPrefix = (prefix) => {
    const out = [];
    let lo = 0;
    let hi = vocab.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (vocab[mid] < prefix) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < vocab.length && vocab[i].startsWith(prefix); i++) {
      out.push(vocab[i]);
      if (out.length >= MAX_PREFIX_EXPANSIONS) break;
    }
    return out;
  };

  // Turns raw input into weighted terms plus filters. `typing` means the last
  // word may be unfinished, so it also matches as a prefix.
  function parseQuery(raw, { typing = false } = {}) {
    let text = ` ${raw.toLowerCase()} `;
    const filters = {};
    const take = (re, key, map = (v) => v) => {
      text = text.replace(re, (_, v) => {
        filters[key] = map(v);
        return ' ';
      });
    };
    take(/\b(20\d\d)\b/, 'year', Number);
    take(/\btier\s*-?\s*(1|2|i{1,2})\b/, 'tier', (v) => (v === '2' || v === 'ii' ? 2 : 1));
    take(/\bshift\s*-?\s*(\d{1,2})\b/, 'shift', Number);

    const tokens = tokenize(text);
    const endsMidWord = typing && /[a-z0-9]$/i.test(raw);
    const terms = new Map();
    const corrections = [];
    let sectionHint = null;

    tokens.forEach((token, i) => {
      // "english idioms" boosts English; a bare "english" lists the section.
      if (SECTION_WORDS[token]) {
        if (tokens.length > 1) sectionHint = SECTION_WORDS[token];
        else filters.section = SECTION_WORDS[token];
        return;
      }
      if (STOPWORDS.has(token)) return;
      const term = normalizeToken(token);
      const isLast = i === tokens.length - 1;
      if (postings[term]) {
        terms.set(term, 1);
      } else if (isLast && endsMidWord && withPrefix(token).length) {
        for (const t of withPrefix(token)) if (!terms.has(t)) terms.set(t, PREFIX_WEIGHT);
      } else {
        const fixed = correct(term);
        if (fixed) {
          terms.set(fixed, SPELL_WEIGHT);
          corrections.push([token, fixed]);
        }
      }
    });
    return { terms, filters, sectionHint, corrections };
  }

  function matchesFilters(doc, filters, section) {
    if (section && doc.section !== section) return false;
    if (filters.year && doc.year !== filters.year) return false;
    if (filters.tier && doc.tier !== filters.tier) return false;
    if (filters.shift && doc.shift !== filters.shift) return false;
    if (filters.section && doc.section !== filters.section) return false;
    return true;
  }

  // Returns { results: [{ id, score }], terms, corrections, filters }.
  /** @param {string} raw @param {{ section?: string | null, typing?: boolean, limit?: number }} [opts] */
  function search(raw, { section = null, typing = false, limit = 200 } = {}) {
    const parsed = parseQuery(raw, { typing });
    const { terms, filters, sectionHint } = parsed;

    if (!terms.size) {
      // Filters only ("2024 tier 1", "english"): list matching papers in order.
      const hasFilter = Object.keys(filters).length || section;
      const results = hasFilter
        ? docs
            .filter((d) => matchesFilters(d, filters, section))
            .sort((a, b) => b.year - a.year || a.tier - b.tier || a.shift - b.shift)
            .slice(0, limit)
            .map((d) => ({ id: d.id, score: 0 }))
        : [];
      return { ...parsed, results };
    }

    const scores = new Map();
    const hits = new Map();
    for (const [term, weight] of terms) {
      const list = postings[term];
      for (let i = 0; i < list.length; i += 2) {
        const id = list[i];
        const tf = list[i + 1];
        const norm = tf + K1 * (1 - B + (B * len[id]) / avgdl);
        scores.set(id, (scores.get(id) || 0) + weight * idf[term] * ((tf * (K1 + 1)) / norm));
        hits.set(id, (hits.get(id) || 0) + weight);
      }
    }

    let totalWeight = 0;
    for (const w of terms.values()) totalWeight += w;
    // Prefix expansions can add many terms; count them as one for coverage.
    const expected = Math.min(totalWeight, [...terms.values()].filter((w) => w === 1).length + 1);

    const results = [];
    for (const [id, base] of scores) {
      const doc = docs[id];
      if (!matchesFilters(doc, filters, section)) continue;
      // Questions containing more of the query words rank above partial matches.
      const coverage = Math.min(1, hits.get(id) / expected);
      let score = base * (0.4 + 0.6 * coverage);
      if (sectionHint && doc.section === sectionHint) score *= 1.5;
      results.push({ id, score });
    }
    results.sort((a, b) => b.score - a.score || docs[b.id].year - docs[a.id].year);
    return { ...parsed, results: results.slice(0, limit) };
  }

  return { search, parseQuery };
}

// Splits text into plain and matched parts for highlighting, using the same
// normalization as the index so "crosses" lights up for a "crossing" query.
export function highlightParts(text, terms) {
  if (!terms || !terms.size) return [{ text, hit: false }];
  const parts = [];
  const re = /[A-Za-z0-9]+/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    const word = m[0].toLowerCase();
    if (!STOPWORDS.has(word) && terms.has(normalizeToken(word))) {
      if (m.index > last) parts.push({ text: text.slice(last, m.index), hit: false });
      parts.push({ text: m[0], hit: true });
      last = m.index + m[0].length;
    }
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts;
}

function oneDeletes(word) {
  const out = [];
  for (let i = 0; i < word.length; i++) out.push(word.slice(0, i) + word.slice(i + 1));
  return out;
}

function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}
