# Claude Code Instructions

## Docker — read this first

All app code runs inside Docker. **Never run `npm`, `node`, or similar commands directly on the host.**

After making any server or client code changes, list the files you changed and tell the user to run:

```
docker compose build app && docker compose up -d app
```

The app container has **no volume mounts** for source files (only `postgres_data` is mounted). Every code change requires a full image rebuild — there is no hot-reload in the container.

## Stack

- **Frontend:** React 18 + TypeScript + Vite, shadcn/ui + Tailwind CSS
- **Routing:** Wouter (not React Router)
- **Data fetching:** TanStack React Query (`queryClient` + `apiRequest` from `client/src/lib/queryClient.ts`)
- **Backend:** Express + TypeScript (`server/routes.ts`, `server/storage.ts`)
- **ORM:** Drizzle ORM + PostgreSQL 16; schema in `shared/schema.ts`
- **Auth:** Session-based (`express-session` + `connect-pg-simple`); `isAuthenticated` middleware on all API routes
- **AI:** Anthropic SDK (`@anthropic-ai/sdk`); users store their own API key in `userSettings.anthropicApiKey`; always use model `claude-haiku-4-5-20251001`

## Key data conventions

- **HSK level -1** = Japanese-only character (not Chinese). Never show an HSK badge for `hskLevel <= 0`.
- **Radical indexes:** `radicalIndex` = simplified radical FK; `radicalIndexTraditional` = traditional radical FK. Both can be null.
- **`profileImageUrl`** stores a base64 data URL (not a file path) — avoids Docker filesystem persistence issues across rebuilds.
- **`anthropicApiKey`** is never returned from the API. The settings endpoint returns `UserSettingsResponse = Omit<UserSettings, "anthropicApiKey"> & { anthropicApiKeySet: boolean }`.

## Seed file + autoSeed pattern

- `server/data/characters-seed.json` is the source of truth for initial character data.
- `server/autoSeed.ts` runs on startup: compares MD5 checksum of the seed file against `app_config.seed_checksum` in the DB. If different → full upsert; if same → skips.
- **Any runtime change to character data** (AI generation, radical correction) must call `patchCharacterInSeed(characterIndex, patch)` from `server/seedWriter.ts`. This writes the patch to the JSON file AND updates the stored checksum so the next restart does not re-upsert stale data.
- Schema migrations (new columns, dropped constraints) go in the migrations block at the top of `server/autoSeed.ts` using `IF NOT EXISTS` / `IF EXISTS` guards.

## AI content generation

- Enabled per-user via `userSettings.aiGenerationMode` toggle in Settings.
- Requires `userSettings.anthropicApiKey` to be set (user provides their own key in Settings).
- Routes: `POST /api/characters/:index/generate` (field generation), `POST /api/characters/:index/verify-radical` (deterministic lookup — no AI), `POST /api/characters/:index/apply-radical` (persist correction).
- All AI-generated/corrected content is saved to DB **and** seed JSON via `patchCharacterInSeed`.

## Radical verification — Unihan database

- `server/data/kangxi-radicals.json` — compact JSON lookup `{ "U+767C": 105, ... }` generated from the Unicode Unihan `kRSUnicode` field (Unicode 17.0). **No AI is used for radical verification** — it is a deterministic lookup.
- `server/unihan.ts` — exports `getKangxiRadicalNumber(char)` which reads this file (lazy-loaded, cached).
- To regenerate after a Unicode update: extract `Unihan_IRGSources.txt` from the new `Unihan.zip` and run the python3 pipeline from the session notes.

## Settings page

- Route: `/settings` (`client/src/pages/settings.tsx`)
- Covers: avatar upload (server resizes to 256×256 JPEG via `sharp`, stores as base64), first/last name, email, all app settings including AI generation toggle.
- Avatar endpoint: `POST /api/user/avatar` (multer → sharp → base64 in `profileImageUrl`).
- Profile endpoint: `PATCH /api/user/profile` (firstName, lastName, email with uniqueness check).
- **Client-side pre-compression:** `client/src/lib/compressImage.ts` resizes to max 512×512 and re-encodes as JPEG (85% quality) in the browser before the multipart upload. Do not add another compression step — the server's `sharp` resize to 256×256 is the second and final pass.

## Customize feature — teacher visibility

- `GET /api/sources`, `GET /api/classes`, `GET /api/lessons` return the caller's own items **plus** items owned by any approved students (when the caller is a teacher). This is handled in the route layer by fetching `getRelationshipsForUser` and passing student IDs as `extraUserIds` to the storage methods.
- Write operations (POST/PATCH/DELETE) remain scoped to `req.user.id` — teachers cannot create, rename, or delete student-owned items. The storage methods enforce this by filtering on `userId`.
- The frontend (`client/src/pages/customize.tsx`) compares each row's `userId` against the logged-in user's id; student-owned rows show a "Student" label instead of the Edit button.

## Component locations

- `CharacterDetailView` — `client/src/components/CharacterDetailView.tsx` (pure display, receives all data + callbacks as props)
- `character-detail.tsx` — `client/src/pages/character-detail.tsx` (data fetching + mutations, wraps CharacterDetailView)
- `AppShell` — `client/src/components/layout/AppShell.tsx` (nav, avatar, gear icon → /settings)
- `SettingsPanel` — `client/src/components/SettingsPanel.tsx` (app settings toggles, embedded in /settings and home)

## Port

App is exposed on **port 5002** (`localhost:5002`). Internal container port is 5000.
