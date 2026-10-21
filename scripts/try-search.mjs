// Quick check of the engine from the command line: node scripts/try-search.mjs "train crosing pole"
import fs from 'node:fs';
import { createEngine } from '../src/search/engine.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const docs = read('questions.json');
const engine = createEngine(read('index.json'), docs);

for (const query of process.argv.slice(2)) {
  const t0 = performance.now();
  const { results, corrections, filters } = engine.search(query, { typing: true });
  const ms = (performance.now() - t0).toFixed(2);
  console.log(`\n"${query}" -> ${results.length} results in ${ms} ms`, corrections.length ? `corrected ${JSON.stringify(corrections)}` : '', Object.keys(filters).length ? `filters ${JSON.stringify(filters)}` : '');
  for (const r of results.slice(0, 3)) console.log(`  ${r.score.toFixed(2)}  [${docs[r.id].section} ${docs[r.id].year}] ${docs[r.id].q.slice(0, 70)}`);
}
