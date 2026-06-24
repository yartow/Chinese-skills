import { db } from "./db";
import { chineseCharacters, chineseWords, radicals } from "@shared/schema";
import { count, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from "crypto";

function seedChecksum(...filePaths: string[]): string {
  const hash = crypto.createHash("md5");
  for (const p of filePaths) {
    if (fs.existsSync(p)) hash.update(fs.readFileSync(p));
  }
  return hash.digest("hex");
}

export async function ensureDataSeeded(log: (msg: string) => void) {
  // ── Schema migrations ─────────────────────────────────────────────────────────
  // Add columns that were introduced after the initial schema deployment.
  try {
    await db.execute(
      sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS handwriting_candidates integer NOT NULL DEFAULT 8`
    );
  } catch {
    // Column already exists or not supported — ignore
  }

  // Allow users to submit multiple reports for the same character (constraint removed).
  try {
    await db.execute(sql`ALTER TABLE character_reports DROP CONSTRAINT IF EXISTS uq_report_user_char`);
  } catch {
    // Constraint already dropped or table doesn't exist — ignore
  }

  try {
    await db.execute(
      sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ai_generation_mode boolean NOT NULL DEFAULT false`
    );
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.execute(
      sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS hsk_color_mode boolean NOT NULL DEFAULT false`
    );
  } catch {
    // Column already exists — ignore
  }

  // Character tags — user-defined labels for grouping characters
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS character_tags (
        id serial PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        UNIQUE (user_id, name)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS character_tag_assignments (
        id serial PRIMARY KEY,
        tag_id integer NOT NULL REFERENCES character_tags(id) ON DELETE CASCADE,
        character_index integer NOT NULL REFERENCES chinese_characters(index) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (tag_id, character_index)
      )
    `);
  } catch (e) {
    log(`Warning: could not create character_tags tables (${e})`);
  }

  // Ensure the app_config table exists and has a default row.
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_config (
        id integer PRIMARY KEY DEFAULT 1,
        auto_reload_database boolean NOT NULL DEFAULT true,
        seed_checksum varchar
      )
    `);
    await db.execute(sql`
      INSERT INTO app_config (id, auto_reload_database) VALUES (1, true)
      ON CONFLICT (id) DO NOTHING
    `);
  } catch (e) {
    log(`Warning: could not create app_config table (${e})`);
  }

  // ── Data cleanup ──────────────────────────────────────────────────────────────
  // Remove duplicate entries where simplified = traditional (bare traditional-form
  // entries) and the character is already represented as the `traditional` column
  // of another entry that has a distinct simplified form. HSK > 0 entries are kept.
  try {
    await db.execute(sql`
      DELETE FROM chinese_characters cc
      WHERE cc.simplified = cc.traditional
        AND cc.hsk_level = 0
        AND EXISTS (
          SELECT 1 FROM chinese_characters cc2
          WHERE cc2.traditional = cc.simplified
            AND cc2.simplified <> cc2.traditional
        )
    `);
  } catch (e) {
    log(`Warning: duplicate-character cleanup failed (${e})`);
  }

  // ── Search indexes ────────────────────────────────────────────────────────────
  // Enable pg_trgm for fast LIKE / ILIKE searches on definition text.
  // These are idempotent — safe to run on every startup.
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    // array_to_string is STABLE (not IMMUTABLE) on some PostgreSQL builds, which
    // prevents its use in an index expression. Wrapping it in an IMMUTABLE function
    // lets PostgreSQL treat the result as a constant for indexing purposes.
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION immutable_array_to_string(arr text[], sep text)
        RETURNS text LANGUAGE sql IMMUTABLE AS
        'SELECT array_to_string($1, $2)'
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cc_definition_trgm
        ON chinese_characters
        USING GIN (LOWER(immutable_array_to_string(definition, ' ')) gin_trgm_ops)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cc_pinyin_trgm
        ON chinese_characters
        USING GIN (pinyin gin_trgm_ops)
    `);
    log("Search indexes OK.");
  } catch (e) {
    log(`Warning: could not create search indexes (${e}) — searches may be slower.`);
  }

  // Build paths relative to the project root (process.cwd()) so this works
  // both in development (tsx) and after bundling where __dirname may differ.
  const radSeedPath = path.join(process.cwd(), "server", "data", "radicals-seed.json");
  const charSeedPath = path.join(process.cwd(), "server", "data", "characters-seed.json");

  // ── Radicals ────────────────────────────────────────────────────────────────
  // Check independently of characters so a database that has characters but no
  // radicals (e.g. after a failed seed) self-heals on the next startup.
  if (fs.existsSync(radSeedPath)) {
    const radData: unknown[] = JSON.parse(fs.readFileSync(radSeedPath, "utf-8"));
    const [radCount] = await db.select({ value: count() }).from(radicals);
    if (radCount.value < radData.length) {
      log(`Radicals table has ${radCount.value}/${radData.length} entries — seeding missing radicals…`);
      for (let i = 0; i < radData.length; i += 100) {
        await db.insert(radicals).values(radData.slice(i, i + 100) as any).onConflictDoNothing();
      }
      log("Radicals seeded.");
    } else {
      log(`Radicals table has ${radCount.value} entries — skipping radical seed.`);
    }
  } else {
    log("Warning: radicals-seed.json not found — skipping radical seed.");
  }

  // ── Characters ──────────────────────────────────────────────────────────────
  if (!fs.existsSync(charSeedPath)) {
    log("Warning: characters-seed.json not found — cannot seed characters.");
    return;
  }

  const charData = JSON.parse(fs.readFileSync(charSeedPath, "utf-8"));
  const [charCount] = await db.select({ value: count() }).from(chineseCharacters);

  if (charCount.value < charData.length) {
    // Fresh or partially-seeded database — insert all characters
    log(`Characters table has ${charCount.value}/${charData.length} entries — seeding missing characters in batches…`);
    for (let i = 0; i < charData.length; i += 100) {
      const batch = charData.slice(i, i + 100);
      await db.insert(chineseCharacters).values(batch).onConflictDoNothing();
      if (i % 500 === 0) log(`  …inserted up to index ${i + 100}`);
    }
    const [newCount] = await db.select({ value: count() }).from(chineseCharacters);
    log(`Seeding complete — ${newCount.value} characters in database.`);
    // fall through — still run word seed
  }

  // ── Seed-file change detection ───────────────────────────────────────────────
  // Read the autoReloadDatabase setting and the last-applied checksum from app_config.
  const wordSeedPathForCheck = path.join(process.cwd(), "server", "data", "words-seed.json");
  const currentChecksum = seedChecksum(charSeedPath, wordSeedPathForCheck);

  let autoReload = true;
  let storedChecksum: string | null = null;
  try {
    const rows = await db.execute(sql`SELECT auto_reload_database, seed_checksum FROM app_config WHERE id = 1`);
    const row = (rows as any).rows?.[0] ?? (rows as any)[0];
    if (row) {
      autoReload = row.auto_reload_database ?? true;
      storedChecksum = row.seed_checksum ?? null;
    }
  } catch (e) {
    log(`Warning: could not read app_config (${e}) — defaulting to autoReload=true`);
  }

  // Also check for structurally stale rows (missing radical_index) as a fallback.
  const [missingRadical] = await db
    .select({ value: count() })
    .from(chineseCharacters)
    .where(isNull(chineseCharacters.radicalIndex));

  const checksumChanged = currentChecksum !== storedChecksum;
  // Only use the radical_index check as a first-run fallback (no stored checksum).
  // If a checksum is already stored, trust it — some seed rows legitimately have
  // null radical_index, and checking would trigger a pointless upsert every startup.
  const needsFullUpsert = checksumChanged || (storedChecksum === null && missingRadical.value > 0);

  if (!autoReload) {
    log(`Auto-reload is disabled — skipping full upsert (seed changes will not be applied).`);
  } else if (needsFullUpsert) {
    const reason = missingRadical.value > 0 ? "missing radical_index" : "seed file changed";
    log(`Running full upsert from seed (${reason})…`);
    let updated = 0;
    for (let i = 0; i < charData.length; i += 100) {
      const batch = charData.slice(i, i + 100);
      await db
        .insert(chineseCharacters)
        .values(batch)
        .onConflictDoUpdate({
          target: chineseCharacters.index,
          set: {
            simplified: sql`excluded.simplified`,
            traditional: sql`excluded.traditional`,
            traditionalVariants: sql`excluded.traditional_variants`,
            pinyin: sql`excluded.pinyin`,
            pinyin2: sql`excluded.pinyin2`,
            pinyin3: sql`excluded.pinyin3`,
            numberedPinyin: sql`excluded.numbered_pinyin`,
            numberedPinyin2: sql`excluded.numbered_pinyin2`,
            numberedPinyin3: sql`excluded.numbered_pinyin3`,
            radicalIndex: sql`excluded.radical_index`,
            radicalIndexTraditional: sql`excluded.radical_index_traditional`,
            definition: sql`excluded.definition`,
            examples: sql`excluded.examples`,
            examplesTraditional: sql`excluded.examples_traditional`,
            hskLevel: sql`excluded.hsk_level`,
            wordExamples: sql`excluded.word_examples`,
            wordExamplesTraditional: sql`excluded.word_examples_traditional`,
            lesson: sql`excluded.lesson`,
            traditionalMappings: sql`excluded.traditional_mappings`,
          },
        });
      updated += batch.length;
      if (i % 500 === 0) log(`  …updated up to index ${i + 100}`);
    }
    // Persist the new checksum so we don't re-upsert on the next startup
    await db.execute(sql`UPDATE app_config SET seed_checksum = ${currentChecksum} WHERE id = 1`);
    log(`Full upsert complete — ${updated} characters updated.`);
  } else {
    log(`Seed file unchanged (checksum match) — skipping full character upsert.`);
  }

  // ── Words ────────────────────────────────────────────────────────────────────
  await ensureWordDataSeeded(log, autoReload, currentChecksum, storedChecksum);
}

async function ensureWordDataSeeded(
  log: (msg: string) => void,
  autoReload: boolean,
  currentChecksum: string,
  storedChecksum: string | null,
) {
  const wordSeedPath = path.join(process.cwd(), "server", "data", "words-seed.json");
  if (!fs.existsSync(wordSeedPath)) {
    log("Warning: words-seed.json not found — skipping word seed.");
    return;
  }

  // Ensure the traditional column exists (added after initial schema deployment)
  try {
    await db.execute(
      sql`ALTER TABLE chinese_words ADD COLUMN IF NOT EXISTS traditional varchar NOT NULL DEFAULT ''`
    );
  } catch {
    // Column already exists or DB doesn't support IF NOT EXISTS — ignore
  }

  const wordData: Array<{
    id: number; word: string; traditional: string;
    pinyin: string; definition: string[]; hskLevel: number; examples: unknown[];
  }> = JSON.parse(fs.readFileSync(wordSeedPath, "utf-8"));

  const [wordCount] = await db.select({ value: count() }).from(chineseWords);

  const needsWordUpsert = wordCount.value < wordData.length || currentChecksum !== storedChecksum;

  if (!autoReload && wordCount.value >= wordData.length) {
    log(`Auto-reload is disabled — skipping word upsert.`);
    return;
  }

  if (!needsWordUpsert) {
    log(`Words table has ${wordCount.value} words, seed unchanged — skipping word upsert.`);
    return;
  }

  log(`Words table has ${wordCount.value}/${wordData.length} entries — upserting words in batches…`);
  for (let i = 0; i < wordData.length; i += 100) {
    const batch = wordData.slice(i, i + 100);
    await db
      .insert(chineseWords)
      .values(batch)
      .onConflictDoUpdate({
        target: chineseWords.id,
        set: {
          word: sql`excluded.word`,
          traditional: sql`excluded.traditional`,
          pinyin: sql`excluded.pinyin`,
          definition: sql`excluded.definition`,
          hskLevel: sql`excluded.hsk_level`,
          examples: sql`CASE WHEN excluded.examples::text <> '[]' THEN excluded.examples ELSE ${chineseWords.examples} END`,
        },
      });
    if (i % 500 === 0) log(`  …seeded up to word ${i + 100}`);
  }
  const [newCount] = await db.select({ value: count() }).from(chineseWords);
  log(`Word seeding complete — ${newCount.value} words in database.`);
}
