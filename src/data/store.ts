// The question bank and search engine, loaded once and shared by every screen.
// questions.json, index.json and meta.json are generated: npm run build:index
import questionsJson from './questions.json';
import indexJson from './index.json';
import metaJson from './meta.json';
import { createEngine } from '@/search/engine';
import { SECTIONS } from '@/config';

export type Question = {
  id: number;
  slug: string;
  section: string;
  topic: string;
  topicSlug: string;
  year: number;
  tier: number;
  shift: number | null;
  q: string;
  options: string[];
  answer: number;
  solution: string;
};

export type Topic = { section: string; slug: string; label: string; count: number };

export type SearchOutput = {
  results: { id: number; score: number }[];
  terms: Map<string, number>;
  filters: { year?: number; tier?: number; shift?: number; section?: string };
};

export const questions = questionsJson as Question[];
export const meta = metaJson as {
  sample: boolean;
  count: number;
  firstYear: number;
  lastYear: number;
  topics: Topic[];
};

const engine = createEngine(indexJson, questions);
export const search = (query: string, opts: { section?: string | null; typing?: boolean } = {}) =>
  engine.search(query, opts) as SearchOutput;

const bySlug = new Map(questions.map((q) => [q.slug, q]));
export const questionBySlug = (slug: string) => bySlug.get(slug);

export const topicsInSection = (section: string) => meta.topics.filter((t) => t.section === section);
export const findTopic = (section: string, slug: string) =>
  meta.topics.find((t) => t.section === section && t.slug === slug);
export const questionsInTopic = (section: string, topicSlug: string) =>
  questions
    .filter((q) => q.section === section && q.topicSlug === topicSlug)
    .sort((a, b) => b.year - a.year || a.tier - b.tier || (a.shift ?? 0) - (b.shift ?? 0));

export const paperLabel = (q: Question) =>
  `${q.year} · Tier ${q.tier}${q.shift ? ` · Shift ${q.shift}` : ''}`;

export const sectionLabel = (slug: string) => SECTIONS.find((s) => s.slug === slug)?.label ?? slug;

// The last results list, so the question screen can step to prev/next.
let lastResults: number[] = [];
export const setLastResults = (ids: number[]) => {
  lastResults = ids;
};
export const neighbours = (id: number) => {
  const i = lastResults.indexOf(id);
  if (i === -1) return { prev: undefined, next: undefined };
  return { prev: questions[lastResults[i - 1]], next: questions[lastResults[i + 1]] };
};
