// Downloads every paper in a source list and parses it to JSON.
//   npm run fetch-papers -- data/sources/prepp-cgl-2024-tier1.json
// PDFs land in data/raw/ (not committed), parsed papers in data/parsed/, and
// figures cropped from them in assets/questions/ (bundled with the app).
// Already-downloaded or already-parsed papers are skipped, so it can be re-run.
// Then: npm run import -- data/parsed
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const listPath = process.argv[2];
if (!listPath) {
  console.error('Usage: npm run fetch-papers -- <source list .json>');
  process.exit(1);
}
const list = JSON.parse(fs.readFileSync(path.resolve(listPath), 'utf8'));
const tag = path.basename(listPath, '.json');
const rawDir = path.join(root, 'data/raw', tag);
const parsedDir = path.join(root, 'data/parsed', tag);
fs.mkdirSync(rawDir, { recursive: true });
fs.mkdirSync(parsedDir, { recursive: true });

let failed = 0;
for (const p of list.papers) {
  const name = `${p.date}-shift-${p.shift}`;
  const pdf = path.join(rawDir, `${name}.pdf`);
  const out = path.join(parsedDir, `${name}.json`);
  try {
    if (!fs.existsSync(pdf)) {
      const res = await fetch(p.url);
      if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
      fs.writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
    }
    if (!fs.existsSync(out)) {
      const log = execFileSync(
        'uv',
        [
          'run', '--no-project', '--with', 'pdfplumber==0.11.4', 'python', '-I', path.join(root, 'scripts/pdf/parse_paper.py'),
          pdf, out, '--shift', String(p.shift), '--images', path.join(root, 'assets/questions'),
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      );
      const paper = JSON.parse(fs.readFileSync(out, 'utf8'));
      paper.meta = { ...paper.meta, date: paper.meta.date ?? p.date, shift: p.shift, exam: list.exam, site: list.site, url: p.url };
      fs.writeFileSync(out, JSON.stringify(paper, null, 1));
      console.log(`${name}: ${log.trim().split('  (')[0]}`);
    } else {
      console.log(`${name}: already parsed`);
    }
  } catch (err) {
    failed++;
    console.error(`${name}: FAILED ${String(err.stderr || err.message).trim().split('\n').pop()}`);
  }
}
console.log(`\n${list.papers.length - failed}/${list.papers.length} papers ready in ${path.relative(root, parsedDir)}`);
if (failed) process.exitCode = 1;
