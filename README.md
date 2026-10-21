# SSC CGL PYQ search

One Expo Router codebase that ships as an Android app and a static, SEO-friendly website.
Search → every matching previous-year question → open one, with its answer, solution and a share button.

## Commands

| Command | What it does |
|---|---|
| `npm run build:index` | Rebuilds `src/data/*` and `public/sitemap.xml` from the question bank. Run after any data change. |
| `npm run try-search -- "train crossing pole"` | Runs the search engine from the terminal, with timings. |
| `npm run android` | Starts the app on a connected phone or emulator (Expo). |
| `npm run build:web` | Rebuilds the index, then exports the static website to `dist/`. |
| `npm run typecheck` | TypeScript check. |

## The question bank

The build reads `data/questions.json`, or `data/questions.sample.json` (35 questions written for testing, with placeholder paper tags) until that file exists. Each question:

```json
{"section":"quant","topic":"Percentage","year":2024,"tier":1,"shift":2,
 "question":"…","options":["…","…","…","…"],"answer":1,"solution":"…"}
```

`section` is one of `quant`, `reasoning`, `english`, `ga`; `answer` is the 0-based index of the correct option; `shift` may be `null` (Tier 2). The build stops and lists every malformed question.

## How search works

- `src/search/normalize.js` reduces text to terms (punctuation, camelCase splits, stopwords, stemming), shared by the build script and the app.
- `scripts/build-index.mjs` writes an inverted index: term → [question id, weighted count, …]. Topic words count ×3, option words ×0.5.
- `src/search/engine.js` scores only the questions that contain a query term with BM25, boosts questions that contain more of the query, corrects spelling against the index vocabulary, treats an unfinished last word as a prefix, and reads years, `tier 2` and `shift 3` as filters.

## Before launch

- Replace `SITE_URL`, `ANDROID_PACKAGE` in `src/config.js` (and `android.package` in `app.json`) with the real domain and package name.
- Replace the sample data with real papers.
