# Chinese Character Learning App

A full-stack Progressive Web App for learning the 3000 most common Chinese characters from the HSK 3.0 curriculum. Features progress tracking, interactive stroke order animations, flashcard-style study modes, handwriting recognition, and AI-powered fill-in-the-blank quizzes.

---

## Features

### Study Modes
- **Daily Mode** — Presents characters based on your current level and daily character limit. Automatically advances to the first unmastered character when you open it.
- **Standard Mode** — Browse all 3000 characters with pagination, HSK level filtering, and progress filtering (show only unmastered characters).
- **Search Mode** — Search by Chinese character, pinyin, or English definition.

### Character Details
Each character shows:
- Simplified and traditional forms (toggle globally)
- Pinyin with tone marks, plus alternative pronunciations where applicable
- Radical, radical pinyin, and stroke count
- English definitions (sourced from CC-CEDICT and Make Me a Hanzi)
- Word examples with pinyin and definitions
- Authentic example sentences (from the Tatoeba corpus)
- Interactive stroke order animation (powered by Hanzi Writer)

### Progress Tracking
Three independent mastery dimensions per character:
- **Reading** (BookOpen icon) — Can you read and recognise it?
- **Writing** (PenTool icon) — Can you write it from memory?
- **Radical** (Grid icon) — Do you know its radical?

A character is fully mastered only when all three are marked complete. A Progress Overview shows four progress bars (reading, writing, radical, fully mastered) across your entire studied set.

### Test Mode
Three flashcard test types:
- **Pronunciation** — See the character; type the pinyin. Accepts any valid alternate pronunciation.
- **Writing** — See the pinyin; type the character in simplified or traditional form.
- **Radical** — See the character; type its radical. Press `n` to advance after a wrong answer.

Filter options for tests:
- Start from a specific character index (with a searchable character browser)
- Restrict to a specific lesson number
- Restrict to a range of lessons
- Show only unmastered characters

### Quiz Mode (two tabs)
- **Fill in the Blank** — An authentic sentence with the target character blanked out. You type the character and Claude AI gives contextual feedback on your answer.
- **Write the Character** — Draw the character on a canvas. HanziLookup stroke recognition checks your drawing against simplified, traditional, and all known traditional variants.

### AI Features (require an Anthropic API key)
Two features use Claude to generate content on demand:
- **AI-generated quiz sentences** — Claude writes a unique example sentence for each character the first time it appears in a quiz. The sentence is stored and reused on subsequent attempts, so the API is only called once per character.
- **Fresh AI feedback** — When you submit a quiz answer, Claude explains why it was right or wrong in context. By default, explanations are cached and reused; enabling "Fresh AI feedback" forces a new explanation to be generated each time.

Both features are disabled by default. To enable them:
1. Open **Settings** (gear icon in the top-right corner).
2. Paste your Anthropic API key (starts with `sk-ant-`) in the **Anthropic API Key** field and click **Save**.
3. Toggle **AI-generated quiz sentences** and/or **Fresh AI feedback** on.

Your key is stored securely on the server and is never returned to the browser. You can get a key at [console.anthropic.com](https://console.anthropic.com).

### Other
- **Simplified / Traditional toggle** — Switch script globally at any time.
- **Installable PWA** — Add to home screen on Android or iOS for an app-like experience with offline caching.
- **Admin tools** — Export all 3000 characters to Excel; import updates for lesson numbers, HSK levels, pinyin, and more.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL (Neon), Drizzle ORM |
| Auth | Replit Auth (OpenID Connect) |
| UI | Tailwind CSS, Shadcn UI, Lucide icons |
| Data fetching | TanStack Query v5 |
| Routing | Wouter |
| Stroke animation | Hanzi Writer |
| Handwriting recognition | HanziLookup (CDN) |
| AI feedback | Claude (Anthropic) |
| Sessions | connect-pg-simple |

---

## Project Structure

```
├── client/               # React frontend (Vite)
│   └── src/
│       ├── components/   # UI components (CharacterCard, TestMode, HandwritingQuiz, …)
│       ├── pages/        # Route pages (home, browse, test-mode, …)
│       └── lib/          # Query client, utilities
├── server/               # Express backend
│   ├── routes.ts         # All API endpoints
│   ├── storage.ts        # Database access layer (IStorage interface)
│   ├── db.ts             # Drizzle database connection
│   └── index.ts          # Server entry point
├── shared/
│   └── schema.ts         # Drizzle schema + Zod types (shared by client & server)
└── public/               # Static assets, PWA manifest, service worker
```

---

## API Overview

| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/user` | Current authenticated user |
| GET | `/api/settings` | User settings |
| POST | `/api/settings` | Update user settings |
| GET | `/api/characters` | Paginated + filtered character list |
| GET | `/api/characters/:index` | Single character detail |
| GET | `/api/characters/search` | Search by character / pinyin / definition |
| GET | `/api/characters/browse` | Lightweight list for the character browser |
| GET | `/api/characters/by-lesson` | Characters in a lesson or lesson range |
| GET | `/api/progress` | User progress records |
| POST | `/api/progress` | Upsert progress for a character |
| GET | `/api/progress/stats` | Aggregate mastery counts |
| GET | `/api/quiz/question` | Random fill-in-the-blank question |
| POST | `/api/quiz/check` | AI-powered answer checking |
| GET | `/api/admin/characters/export` | Download characters as `.xlsx` |
| POST | `/api/admin/characters/import` | Upload `.xlsx` to update character fields |

---

## Data Sources

- **HSK 3.0 character list** — [alyssabedard/chinese-hsk-and-frequency-lists](https://github.com/alyssabedard/chinese-hsk-and-frequency-lists)
- **Radical data & definitions** — [Make Me a Hanzi](https://github.com/skishore/makemeahanzi)
- **Dictionary definitions** — [CC-CEDICT](https://cc-cedict.org/)
- **Example sentences** — [Tatoeba Project](https://tatoeba.org/) (30,000+ Chinese–English pairs)

---

## Getting Started

The app runs on Replit with the `Start application` workflow (`npm run dev`), which starts both the Express server and Vite dev server on the same port.

Environment variables required:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for session signing |
| `ANTHROPIC_API_KEY` | *(Optional)* Server-level fallback API key for AI features. Users can supply their own key via the Settings panel instead. |

In production, the server automatically runs `npm run db:push` on startup to sync any schema changes to the database.

### Anthropic API Key

AI features (fill-in-the-blank quiz feedback and AI-generated sentences) require an Anthropic API key. There are two ways to provide one:

1. **Per-user (recommended)** — Each user enters their own key in **Settings → Anthropic API Key**. The key is stored in the database, scoped to that user, and never sent back to the browser.
2. **Server-wide fallback** — Set the `ANTHROPIC_API_KEY` environment variable. This key is used for any user who has not set their own. Leave it unset if you want each user to supply their own key.

If no key is available for a user, AI features will gracefully fail with an error message rather than crashing.

---

## Roadmap

More features are planned. Contributions and suggestions are welcome via issues and pull requests.

---

## What This App Does Not Cover (Yet)

The app focuses on character recognition and writing. If you are preparing for a formal HSK exam, the following areas are tested but not currently covered:

### Listening (35% of the test — biggest gap)
- Short dialogues with true/false questions
- Multi-turn conversations with multiple choice
- You need to practise recognising spoken Mandarin at natural speed, tones included
- Resources: HSK Standard Course audio, ChinesePod, Mandarin Corner on YouTube

### Word Ordering (排列句子)
- You are given 4–5 words/phrases and must arrange them into a correct sentence
- Tests grammar knowledge, not just vocabulary
- Very common on the test and hard to improvise

### Reading Passages
- Short paragraphs (50–100 characters) followed by questions
- Differs from single-character exercises — you need to read at pace and infer meaning from context

### Grammar Pattern Drilling
HSK 3 has specific patterns you must know cold:
- 把 / 被 sentences
- 虽然…但是, 因为…所以, 不但…而且
- Resultative complements (做完, 学会, 听懂)
- 是…的 emphasis structure
- Measure words (量词) for a wide range of nouns

### Exam-Style Multiple-Choice / Cloze Completion
The vocabulary quiz already supports fill-in-the-blank sentence completion with full words. What is not yet covered is the official HSK exam format: a sentence with a blank and four word options to choose from (multiple-choice cloze), including distractor options chosen to test grammatical and semantic distinctions.

### Timed Mock Tests
- The real test is strictly timed. Practising under time pressure is essential.
- Official HSK 3 past papers are available from Hanban/NEEA

### Practical Suggestions for Exam Prep
1. **Start with the official HSK 3 Standard Course book** (汉语水平考试标准教程 3) — structured exactly around the test format and includes audio
2. **Do at least one full mock test per week** under timed conditions
3. **Anki for vocabulary** — HSK 3 has 600 words; recognising them as whole words (not just the characters) is different from what this app trains
4. **Speaking practice** — HSK 3 does not test speaking, but producing sentences yourself cements grammar patterns far better than recognition exercises


![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/yartow/Chinese-skills?utm_source=oss&utm_medium=github&utm_campaign=yartow%2FChinese-skills&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)