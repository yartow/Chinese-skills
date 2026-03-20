import { db } from "./db";
import { chineseCharacters, radicals } from "@shared/schema";
import { count } from "drizzle-orm";
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
  const [charCount] = await db.select({ value: count() }).from(chineseCharacters);
  if (charCount.value > 0) {
    log(`Characters table has ${charCount.value} characters — skipping character seed.`);
    return;
  }

  if (!fs.existsSync(charSeedPath)) {
    log("Warning: characters-seed.json not found — cannot seed characters.");
    return;
  }

  const charData = JSON.parse(fs.readFileSync(charSeedPath, "utf-8"));
  log(`Characters table is empty — seeding ${charData.length} characters in batches…`);

  for (let i = 0; i < charData.length; i += 100) {
    const batch = charData.slice(i, i + 100);
    await db.insert(chineseCharacters).values(batch).onConflictDoNothing();
    if (i % 500 === 0) log(`  …inserted up to index ${i + 100}`);
  }

  const [newCount] = await db.select({ value: count() }).from(chineseCharacters);
  log(`Seeding complete — ${newCount.value} characters in database.`);
}
