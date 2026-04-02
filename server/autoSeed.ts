import { db } from "./db";
import { chineseCharacters, radicals } from "@shared/schema";
import { count, eq, isNull } from "drizzle-orm";
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
    return;
  }

  log(`Characters table has ${charCount.value} characters — skipping character seed.`);

  // ── Targeted data patches ────────────────────────────────────────────────────
  // Fix index 1550 (扣/釦): second example used 敲 (to knock) instead of 扣.
  // Replace with a sentence that actually contains 扣/釦.
  await patchKouExamples(log);
}

async function patchKouExamples(log: (msg: string) => void) {
  const [row] = await db
    .select({ examples: chineseCharacters.examples, examplesTraditional: chineseCharacters.examplesTraditional })
    .from(chineseCharacters)
    .where(eq(chineseCharacters.index, 1550));

  if (!row) return;

  const examples = row.examples as { chinese: string; english: string }[];
  if (!examples?.some((e) => e.chinese.includes("指关节"))) return; // already fixed

  const fixedExamples = examples.map((e) =>
    e.chinese.includes("指关节")
      ? { ...e, chinese: "他用指关节轻轻扣了扣门。" }
      : e
  );
  const examplesTrad = row.examplesTraditional as { chinese: string; english: string }[];
  const fixedTrad = (examplesTrad ?? []).map((e) =>
    e.chinese.includes("指關節")
      ? { ...e, chinese: "他用指關節輕輕扣了扣門。" }
      : e
  );

  await db.update(chineseCharacters)
    .set({ examples: fixedExamples, examplesTraditional: fixedTrad })
    .where(eq(chineseCharacters.index, 1550));

  log("Patched index 1550 (扣/釦): replaced incorrect 敲門 example with 扣門.");
}
