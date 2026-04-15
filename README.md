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

## scripts/post-merge.sh

This script (`npm install` + `npm run db:push`) is invoked automatically by the Replit task system after a task-agent branch is merged. It is **not** a git hook and is not installed in `.git/hooks/`.

**Safety guard:** The script refuses to run unless `ALLOW_DB_PUSH=true` is set in the environment. This prevents accidental execution in CI or production:

```bash
ALLOW_DB_PUSH=true bash scripts/post-merge.sh
```

**Optional local hook:** If you want schema pushes to happen automatically after every local `git merge`, copy it manually — do not commit hooks:

```bash
cp scripts/post-merge.sh .git/hooks/post-merge
chmod +x .git/hooks/post-merge
# then set ALLOW_DB_PUSH=true in your shell profile
```

`npm run db:push` can prompt to drop columns or tables when destructive schema changes are detected. Always review diffs before running against a database that holds real data.

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

### Post-Merge Git Hook (Optional)

The repository includes a `scripts/post-merge.sh` script that can automate `npm install` and `npm run db:push` after pulling changes that include schema updates. **This script is not installed automatically** to prevent accidental database pushes in CI or production environments.

**To install locally:**
```bash
cp scripts/post-merge.sh .git/hooks/post-merge
chmod +x .git/hooks/post-merge
export CHECKOUT_DB_PUSH=true  # Add to your .bashrc/.zshrc for persistence
```

**Safety implications:**
- The script will only run `npm run db:push` if `CHECKOUT_DB_PUSH=true` or `NODE_ENV=development` is set in your environment
- Without this guard, the script exits early after printing a skip message
- **Never commit files in `.git/hooks/`** — git hooks are local-only and should not be version controlled
- This prevents accidental schema pushes in CI pipelines or production deploys that might pull changes

### Anthropic API Key

AI features (fill-in-the-blank quiz feedback and AI-generated sentences) require an Anthropic API key. There are two ways to provide one:

1. **Per-user (recommended)** — Each user enters their own key in **Settings → Anthropic API Key**. The key is stored in the database, scoped to that user, and never sent back to the browser.
2. **Server-wide fallback** — Set the `ANTHROPIC_API_KEY` environment variable. This key is used for any user who has not set their own. Leave it unset if you want each user to supply their own key.

If no key is available for a user, AI features will gracefully fail with an error message rather than crashing.

---

## Python Scripts (`source files/`)

These scripts manage the database content from the command line. Most require environment variables set before running:

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chinese_learning
export ANTHROPIC_API_KEY=sk-ant-...   # only scripts that call Claude
```

Make sure the Docker database is running first (`docker compose up -d`).

---

### `enrich_character.py` — Enrich individual characters with Claude

Re-generates AI-enriched fields for one or more characters already in the database. Useful when a character was imported with basic data (pinyin + definition) but is missing examples, radical, compound words, or alternate pronunciations.

**What it fills in:** `hsk_level` (corrects if wrong), `traditional_variants`, `pinyin2`/`pinyin3` (多音字), `numbered_pinyin` 1–3, `radical_index`, `examples` (3 sentences, simplified + traditional), `word_examples` (3 compounds, simplified + traditional).

**What it does not touch:** `index`, `simplified`, `pinyin`, `definition`, `lesson` — those are treated as authoritative from the original import.

```bash
# Enrich a single character
python3 "source files/enrich_character.py" 嘌

# Enrich multiple characters at once
python3 "source files/enrich_character.py" 嘌 呤 囧

# Preview what would be written without touching the database
python3 "source files/enrich_character.py" 嘌 --dry-run
```

| Option | Description |
|---|---|
| `characters` | One or more simplified Chinese characters (required) |
| `--dry-run` | Print the generated data without writing to the database |

---

### `generate_word_examples.py` — Generate example sentences for vocabulary words

Generates fill-in-blank example sentences for every row in `chinese_words` where `examples` is empty. Each word gets one sentence in simplified Chinese. After running, export with `npx tsx server/exportSeedData.ts` and commit to propagate to production.

```bash
# Fill all empty rows (may take a while for thousands of words)
python3 "source files/generate_word_examples.py"

# Preview without writing
python3 "source files/generate_word_examples.py" --dry-run

# Process only the first 50 words (useful for testing)
python3 "source files/generate_word_examples.py" --limit 50

# Regenerate sentences even for words that already have one
python3 "source files/generate_word_examples.py" --overwrite
```

| Option | Description |
|---|---|
| `--dry-run` | Print generated sentences without writing to the database |
| `--limit N` | Process at most N words (default: all empty rows) |
| `--overwrite` | Regenerate even if a sentence already exists |

---

### `import_excel_characters.py` — Bulk-import from `mega_hanzi_compilation.xlsx`

One-time bulk import of non-HSK characters from the master Excel file. Assigns database indexes starting at 3000 (after the 3000 HSK characters). Does **not** use the Claude API — all data comes directly from the Excel file. Examples and radical fields are left empty and can be filled later with `enrich_character.py`.

Characters already in the database (matched by simplified form) are skipped. Characters missing a pinyin value are also skipped (pinyin is required).

```bash
# Import all non-HSK characters
python3 "source files/import_excel_characters.py"

# Preview the first batch without writing
python3 "source files/import_excel_characters.py" --dry-run
```

| Option | Description |
|---|---|
| `--dry-run` | Print what would be imported without writing to the database |

**Does not need `ANTHROPIC_API_KEY`.**

---

### `add_characters.py` — Add characters from a CSV file with Claude enrichment

Adds new characters from a master CSV to the database, calling Claude to fill in anything not supplied by the CSV (traditional form, pinyin, definitions, examples, radical, compound words). The CSV row number determines the database index, so row ordering must be stable.

```bash
# Add characters at indexes 3000–3999
python3 "source files/add_characters.py" --source hsk.csv --from-to 3000 4000

# Add a single character (for testing)
python3 "source files/add_characters.py" --source hsk.csv --from-to 3005 3006

# Preview without writing
python3 "source files/add_characters.py" --source hsk.csv --from-to 3000 4000 --dry-run

# Regenerate rows that already exist
python3 "source files/add_characters.py" --source hsk.csv --from-to 3000 4000 --overwrite
```

| Option | Description |
|---|---|
| `--source FILE` | Path to the master CSV file (required) |
| `--from-to START END` | Index range to process — START inclusive, END exclusive (required) |
| `--dry-run` | Print what would be inserted without writing to the database |
| `--overwrite` | Delete and re-generate rows that already exist |

**CSV columns used:** `hanzi_sc` (simplified), `hanzi_trad` (traditional), `pinyin`, `level` (HSK 1–9), `cc_cedict_definitions`. All except `hanzi_sc` are optional — Claude fills in anything missing.

---

### `fix_characters.py` — Repair broken data in the database

Two-phase repair tool:

- **Phase 1** — Fixes the `traditional` column where it holds an archaic or obscure variant not used in modern Taiwan/HK Chinese. Claude returns the correct modern form.
- **Phase 2** — Regenerates example sentences where the sentence does not actually contain the target character (a common validation failure).

```bash
# Run both phases
python3 "source files/fix_characters.py"

# Run only phase 1 (fix traditional forms)
python3 "source files/fix_characters.py" --phase 1

# Run only phase 2 (regenerate broken examples)
python3 "source files/fix_characters.py" --phase 2

# Preview without writing
python3 "source files/fix_characters.py" --dry-run
```

| Option | Description |
|---|---|
| `--phase 1` or `--phase 2` | Run only that phase (default: both) |
| `--dry-run` | Print what would change without writing to the database |

---

### `validate_examples.py` — Find characters with broken example sentences

Scans the entire `chinese_characters` table and reports every row where an example sentence does not contain the character it is supposed to illustrate. Checks all four example columns: `examples`, `examples_traditional`, `word_examples`, `word_examples_traditional`. Read-only — makes no changes.

```bash
python3 "source files/validate_examples.py"
```

Use this before running `fix_characters.py --phase 2` to see the scope of the problem first.

**Does not need `ANTHROPIC_API_KEY`.**

---

### Typical workflows

**Add enriched data for one character:**
```bash
python3 "source files/enrich_character.py" 嘌 --dry-run   # preview
python3 "source files/enrich_character.py" 嘌              # write
npx tsx server/exportSeedData.ts                            # update seed file
git add server/data/                                        # commit + push to deploy
```

**Generate word examples and deploy:**
```bash
python3 "source files/generate_word_examples.py" --limit 100  # test batch
python3 "source files/generate_word_examples.py"               # fill all
npx tsx server/exportSeedData.ts
git add server/data/words-seed.json
git commit -m "Add word examples"
```

**Find and fix broken examples:**
```bash
python3 "source files/validate_examples.py"            # identify broken rows
python3 "source files/fix_characters.py" --dry-run     # preview fixes
python3 "source files/fix_characters.py"               # apply fixes
npx tsx server/exportSeedData.ts                        # export + commit
```

---

### Legacy scripts (Excel-based, pre-database)

These scripts operated on Excel files before the data was moved to PostgreSQL. They are kept for reference but are not part of the normal workflow.

| Script | Purpose |
|---|---|
| `app.py` | Standalone Flask quiz app that reads from an Excel file directly |
| `enrich_chinese.py` | Batch-enriched an Excel export with Claude-generated examples and compound words |
| `fix_duoyinzi.py` | Fixed missing alternate pronunciations (多音字) in an Excel file |
| `populate_radicals.py` | Populated radical columns in an Excel file using Claude |
| `translate_traditional.py` | Translated simplified example sentences to traditional Chinese in an Excel file |

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