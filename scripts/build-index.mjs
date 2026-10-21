// Builds everything the app and website read from the question bank:
//   src/data/questions.json  the questions, with ids, slugs and topic slugs
//   src/data/index.json      the inverted index for BM25
//   src/data/meta.json       counts and the topic list
//   public/sitemap.xml, public/robots.txt
// Reads data/questions.json, or data/questions.sample.json until real papers exist.
// Run: npm run build:index
import fs from 'node:fs';
import path from 'node:path';
import { analyze, slugify, tokenize } from '../src/search/normalize.js';
import { SECTIONS, SITE_URL } from '../src/config.js';

const root = path.resolve(import.meta.dirname, '..');
const realPath = path.join(root, 'data/questions.json');
const samplePath = path.join(root, 'data/questions.sample.json');
const sample = !fs.existsSync(realPath);
const source = sample ? samplePath : realPath;
const raw = JSON.parse(fs.readFileSync(source, 'utf8'));

// Topic words count three times, options half: a "synonyms" query should rank
// synonym questions first, and an answer word should still find its question.
const FIELD_WEIGHTS = { topic: 3, question: 1, options: 0.5 };

const sectionSlugs = new Set(SECTIONS.map((s) => s.slug));
const errors = [];
const usedSlugs = new Set();

const docs = raw.map((q, id) => {
  const where = `question ${id + 1} ("${String(q.question).slice(0, 40)}")`;
  if (!sectionSlugs.has(q.section)) errors.push(`${where}: unknown section "${q.section}"`);
  if (!q.topic) errors.push(`${where}: missing topic`);
  if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${where}: needs options`);
  else if (q.answer != null && !(q.answer >= 0 && q.answer < q.options.length)) errors.push(`${where}: answer out of range`);
  for (const k of ['year', 'tier']) if (!Number.isInteger(q[k])) errors.push(`${where}: ${k} must be a number`);

  // A figure-only question has no text to name it by.
  let slug = slugify(q.question) || `${slugify(q.topic)}-figure-${q.year}-${id + 1}`;
  if (usedSlugs.has(slug)) slug = `${slug}-${q.year}-${id + 1}`;
  usedSlugs.add(slug);

  return {
    id,
    slug,
    section: q.section,
    topic: q.topic,
    // Every word kept: "one-word-substitution" is the phrase people search for.
    topicSlug: tokenize(q.topic).join('-'),
    year: q.year,
    tier: q.tier,
    shift: q.shift ?? null,
    q: q.question,
    options: q.options,
    answer: q.answer ?? null,
    answerSource: q.answerSource ?? null,
    solution: q.solution ?? '',
    figures: q.figures ?? [],
    optionFigures: q.optionFigures ?? {},
  };
});

// Every figure is required statically so Metro bundles it into the app and
// copies it into the website export.
const figureFiles = [...new Set(docs.flatMap((d) => [...d.figures, ...Object.values(d.optionFigures)].map((f) => f.file)))].sort();
for (const file of figureFiles) {
  if (!fs.existsSync(path.join(root, 'assets/questions', file))) errors.push(`missing figure assets/questions/${file}`);
}

if (errors.length) {
  console.error(`${errors.length} problem(s) in ${path.basename(source)}:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}

const postings = {};
const len = [];
for (const doc of docs) {
  const tf = new Map();
  const addField = (text, weight) => {
    for (const term of analyze(text)) tf.set(term, (tf.get(term) || 0) + weight);
  };
  addField(doc.topic, FIELD_WEIGHTS.topic);
  addField(doc.q, FIELD_WEIGHTS.question);
  addField(doc.options.join(' '), FIELD_WEIGHTS.options);

  let total = 0;
  for (const [term, count] of tf) {
    (postings[term] ||= []).push(doc.id, Math.round(count * 10) / 10);
    total += count;
  }
  len.push(Math.round(total * 10) / 10);
}
const avgdl = len.reduce((a, b) => a + b, 0) / docs.length;

const topics = new Map();
for (const d of docs) {
  const key = `${d.section}/${d.topicSlug}`;
  const t = topics.get(key) || { section: d.section, slug: d.topicSlug, label: d.topic, count: 0 };
  t.count++;
  topics.set(key, t);
}
const years = docs.map((d) => d.year);
const meta = {
  sample,
  count: docs.length,
  firstYear: Math.min(...years),
  lastYear: Math.max(...years),
  topics: [...topics.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
};

const write = (rel, content) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return `${rel} (${(Buffer.byteLength(content) / 1024).toFixed(1)} KB)`;
};

const urls = [
  '/',
  '/download',
  ...SECTIONS.map((s) => `/${s.slug}`),
  ...meta.topics.map((t) => `/${t.section}/${t.slug}`),
  ...docs.map((d) => `/q/${d.slug}`),
];
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url><loc>${SITE_URL}${u === '/' ? '' : u}</loc></url>`).join('\n') +
  '\n</urlset>\n';

const written = [
  write('src/data/questions.json', JSON.stringify(docs)),
  write('src/data/index.json', JSON.stringify({ N: docs.length, avgdl, len, postings })),
  write('src/data/meta.json', JSON.stringify(meta, null, 2)),
  write(
    'src/data/figures.ts',
    '// Generated by scripts/build-index.mjs: every question figure, required so Metro bundles it.\n' +
      'export const figureSources: Record<string, number> = {\n' +
      figureFiles.map((f) => `  '${f}': require('../../assets/questions/${f}'),`).join('\n') +
      '\n};\n'
  ),
  write('public/sitemap.xml', sitemap),
  write('public/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`),
];

console.log(
  `${docs.length} questions from ${path.basename(source)}${sample ? ' (SAMPLE DATA)' : ''}, ` +
    `${Object.keys(postings).length} terms, ${meta.topics.length} topics\n  ${written.join('\n  ')}`
);
