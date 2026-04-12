import { db } from "./db";
import { chineseCharacters, chineseWords, radicals } from "@shared/schema";
import { count, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

export async function ensureDataSeeded(log: (msg: string) => void) {
  // ── Search indexes ────────────────────────────────────────────────────────────
  // Enable pg_trgm for fast LIKE / ILIKE searches on definition text.
  // These are idempotent — safe to run on every startup.
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cc_definition_trgm
        ON chinese_characters
        USING GIN (LOWER(array_to_string(definition, ' ')) gin_trgm_ops)
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

  // ── Stale-data check ────────────────────────────────────────────────────────
  // If any characters are missing radical_index or radical_index_traditional,
  // the database was seeded with old data. Run a full upsert to bring all
  // character records up to date with the current seed file.
  const [missingRadical] = await db
    .select({ value: count() })
    .from(chineseCharacters)
    .where(isNull(chineseCharacters.radicalIndex));

  const [missingRadicalTrad] = await db
    .select({ value: count() })
    .from(chineseCharacters)
    .where(isNull(chineseCharacters.radicalIndexTraditional));

  if (missingRadical.value > 0 || missingRadicalTrad.value > 0) {
    log(`Characters table has ${charCount.value} rows but ${missingRadical.value} missing radical_index and ${missingRadicalTrad.value} missing radical_index_traditional — running full upsert from seed…`);
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
          },
        });
      updated += batch.length;
      if (i % 500 === 0) log(`  …updated up to index ${i + 100}`);
    }
    log(`Full upsert complete — ${updated} characters updated.`);
    // fall through — still run word seed
  } else {
    log(`Characters table has ${charCount.value} characters — skipping character seed.`);
  }

  // ── Words ────────────────────────────────────────────────────────────────────
  await ensureWordDataSeeded(log);
}

async function ensureWordDataSeeded(log: (msg: string) => void) {
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

  // Always upsert — this backfills the traditional column for pre-existing rows
  // that were inserted before the column was added, and inserts any missing rows.
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
