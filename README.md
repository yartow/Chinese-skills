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

In production, the server automatically runs `npm run db:push` on startup to sync any schema changes to the database.
