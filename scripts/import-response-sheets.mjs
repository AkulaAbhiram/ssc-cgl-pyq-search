// Imports SSC CGL response sheets (saved from the candidate's login on
// ssc.gov.in, which shows the full shift paper with the final answer key)
// into the question bank, data/questions.json.
//
//   npm run import -- path/to/sheet.html [more.html | a-folder ...] [--dry-run] [--out file.json]
//
// Each sheet is one shift paper. Questions already in the bank (same SSC
// question ID, or same text and options) are skipped, so the same paper saved
// by two candidates imports once. Questions that need an image (figures,
// typeset maths) are skipped and counted until the app can show images.
// Then run: npm run build:index
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const outIdx = args.indexOf('--out');
const outPath = outIdx !== -1 ? path.resolve(args[outIdx + 1]) : path.join(root, 'data/questions.json');
const inputs = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');

if (!inputs.length) {
  console.error('Usage: npm run import -- <sheet.html | folder> [...] [--dry-run] [--out file.json]');
  process.exit(1);
}

const SECTION_MAP = [
  [/reasoning|intelligence/i, 'reasoning'],
  [/general awareness|general knowledge|general studies/i, 'ga'],
  [/quantitative|mathematical abilit|arithmetic/i, 'quant'],
  [/english/i, 'english'],
];

const rules = JSON.parse(fs.readFileSync(path.join(root, 'data/topic-rules.json'), 'utf8'));
const compiled = Object.fromEntries(
  Object.entries(rules)
    .filter(([k]) => !k.startsWith('_'))
    .map(([section, list]) => [section, list.map((r) => ({ topic: r.topic, re: new RegExp(r.pattern, 'i') }))])
);

const files = inputs.flatMap((p) => {
  const abs = path.resolve(p);
  if (fs.statSync(abs).isDirectory()) {
    return fs.readdirSync(abs).filter((f) => /\.html?$/i.test(f)).map((f) => path.join(abs, f));
  }
  return [abs];
});

const bank = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : [];
const seen = new Set(bank.flatMap((q) => [q.qid && `id:${q.qid}`, `tx:${fingerprint(q.question, q.options)}`]).filter(Boolean));

const report = { added: 0, duplicate: 0, image: 0, hindiOnly: 0, noAnswer: 0, otherSection: 0, untagged: [] };
for (const file of files) {
  const sheet = parseSheet(fs.readFileSync(file, 'utf8'), file);
  console.log(`${path.basename(file)}: ${sheet.label}, ${sheet.questions.length} questions found`);
  for (const q of sheet.questions) {
    if (q.skip) {
      report[q.skip]++;
      continue;
    }
    const keys = [q.qid && `id:${q.qid}`, `tx:${fingerprint(q.question, q.options)}`].filter(Boolean);
    if (keys.some((k) => seen.has(k))) {
      report.duplicate++;
      continue;
    }
    keys.forEach((k) => seen.add(k));
    if (q.topic === 'Miscellaneous') report.untagged.push(`[${q.section}] ${q.question.slice(0, 90)}`);
    bank.push(q);
    report.added++;
  }
}

if (!dryRun && report.added) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(bank, null, 1));
}

console.log(
  `\n${dryRun ? 'Dry run: would add' : 'Added'} ${report.added} question(s) → ${path.relative(root, outPath)} (${bank.length} in bank)\n` +
    `Skipped: ${report.duplicate} already in bank, ${report.image} need an image, ${report.hindiOnly} Hindi-only, ` +
    `${report.noAnswer} with no marked answer, ${report.otherSection} outside the four sections`
);
if (report.untagged.length) {
  console.log(`\n${report.untagged.length} tagged "Miscellaneous" — set their topic by hand or add a rule to data/topic-rules.json:`);
  for (const line of report.untagged) console.log(`  ${line}`);
}
if (report.added && !dryRun) console.log('\nNext: npm run build:index');

// --- parsing -------------------------------------------------------------

function parseSheet(html, file) {
  const $ = cheerio.load(html);
  const info = readHeader($);
  if (!/combined graduate level|\bcgl\b/i.test(info.subject)) {
    console.warn(`  ${path.basename(file)}: subject "${info.subject || 'unknown'}" doesn't look like SSC CGL; importing anyway`);
  }
  const year = Number((info.subject.match(/\b(20\d\d)\b/) || info.date.match(/(20\d\d)/) || [])[1]) || null;
  const tier = /tier[\s-]*(ii|2)\b/i.test(info.subject) ? 2 : 1;
  const shift = tier === 1 ? shiftFromTime(info.time) : null;
  const label = `SSC CGL ${year ?? '?'} Tier ${tier}${shift ? ` shift ${shift}` : ''} (${info.date || 'no date'} ${info.time})`.trim();
  if (!year) throw new Error(`${path.basename(file)}: couldn't read the exam year from the sheet header`);

  const questions = [];
  // Each question sits in a .question-pnl wrapping a table.questionPnlTbl;
  // take one or the other, never both, or every question is read twice.
  const blocks = $('.question-pnl').length ? $('.question-pnl') : $('table.questionPnlTbl');
  if (!blocks.length) {
    throw new Error(
      `${path.basename(file)}: no questions found. This doesn't look like an SSC response sheet page; ` +
        'save the response sheet page itself (Ctrl+S, "Webpage, complete") and try again.'
    );
  }

  blocks.each((_, el) => {
    const block = $(el);
    const sectionLabel = block.closest('.section-cntnr').find('.section-lbl').first().text().replace(/^\s*section\s*:\s*/i, '').trim();
    const section = SECTION_MAP.find(([re]) => re.test(sectionLabel))?.[1];
    const qid = rowValue($, block.find('.menu-tbl'), /question id/i);

    const rowTbl = block.find('table.questionRowTbl').first();
    const qCell = rowTbl.find('tr').first().find('td').eq(1);
    const optionCells = rowTbl
      .find('tr')
      .slice(1)
      .map((__, tr) => $(tr).find('td').last())
      .get()
      .filter((td) => $(td).text().trim() || $(td).find('img').length);

    const question = clean($(qCell).text());
    const options = optionCells.map((td) => clean($(td).text()).replace(/^\(?[1-5a-e][.)]\s*/i, ''));
    const answer = optionCells.findIndex((td) => $(td).hasClass('rightAns') || $(td).find('.rightAns').length);
    const needsImage = $(qCell).find('img').length > 0 || optionCells.some((td) => $(td).find('img').length && !clean($(td).text()).replace(/^\(?[1-5][.)]/, ''));

    let skip = null;
    if (!section) skip = 'otherSection';
    else if (needsImage || !question) skip = 'image';
    else if (isMostlyHindi(question)) skip = 'hindiOnly';
    else if (answer === -1 || options.length < 2) skip = 'noAnswer';

    questions.push({
      skip,
      section,
      topic: section ? tagTopic(section, `${question} ${options.join(' ')}`) : null,
      year,
      tier,
      shift,
      date: info.date || null,
      time: info.time || null,
      question,
      options,
      answer,
      solution: '',
      qid: qid || null,
      source: `SSC CGL ${year} Tier ${tier === 2 ? 'II' : 'I'}, ${info.date} ${info.time}, final answer key`.replace(/\s+,/g, ','),
    });
  });
  return { label, questions };
}

function readHeader($) {
  const get = (re) => {
    let value = '';
    $('td').each((_, td) => {
      if (!value && re.test($(td).text().trim())) value = clean($(td).next('td').text());
    });
    return value;
  };
  return { subject: get(/^subject\b/i) || get(/^exam(ination)? name/i), date: get(/^test date/i), time: get(/^test time/i) };
}

function rowValue($, table, labelRe) {
  let value = '';
  table.find('td').each((_, td) => {
    if (!value && labelRe.test($(td).text())) value = clean($(td).next('td').text());
  });
  return value;
}

// CGL Tier 1 runs three or four shifts a day; number them by start time.
function shiftFromTime(time) {
  const m = String(time).match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3]?.toLowerCase() === 'pm' && h !== 12) h += 12;
  if (h < 11) return 1;
  if (h < 14) return 2;
  if (h < 16) return 3;
  return 4;
}

function tagTopic(section, text) {
  return compiled[section]?.find((r) => r.re.test(text))?.topic ?? 'Miscellaneous';
}

function clean(s) {
  return String(s).replace(/[✔✘✓✗]/g, '').replace(/\s+/g, ' ').trim();
}

function isMostlyHindi(s) {
  const devanagari = (s.match(/[ऀ-ॿ]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  return devanagari > latin;
}

function fingerprint(question, options = []) {
  return `${question} | ${options.join(' | ')}`.toLowerCase().replace(/[^a-z0-9|]+/g, '');
}
