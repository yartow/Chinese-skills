import { db } from "./db";
import { chineseCharacters, radicals } from "@shared/schema";
import { count, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

export async function ensureDataSeeded(log: (msg: string) => void) {
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
    return;
  }

  // ── Stale-data check ────────────────────────────────────────────────────────
  // If any characters are missing radical_index, the database was seeded with
  // old data (before radical linkage was added). Run a full upsert to bring all
  // character records up to date with the current seed file.
  const [missingRadical] = await db
    .select({ value: count() })
    .from(chineseCharacters)
    .where(isNull(chineseCharacters.radicalIndex));

  if (missingRadical.value > 0) {
    log(`Characters table has ${charCount.value} rows but ${missingRadical.value} are missing radical data — running full upsert from seed…`);
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
            definition: sql`excluded.definition`,
            examples: sql`excluded.examples`,
            hskLevel: sql`excluded.hsk_level`,
            wordExamples: sql`excluded.word_examples`,
            lesson: sql`excluded.lesson`,
          },
        });
      updated += batch.length;
      if (i % 500 === 0) log(`  …updated up to index ${i + 100}`);
    }
    log(`Full upsert complete — ${updated} characters updated.`);
    return;
  }

  log(`Characters table has ${charCount.value} characters — skipping character seed.`);
}
