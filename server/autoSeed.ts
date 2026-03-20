import { db } from "./db";
import { chineseCharacters, radicals } from "@shared/schema";
import { count } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function ensureDataSeeded(log: (msg: string) => void) {
  // Check radicals independently — seed if missing even if characters already exist.
  // This self-heals databases that have characters but no radicals (FK constraint issue).
  const [radCount] = await db.select({ value: count() }).from(radicals);
  if (radCount.value === 0) {
    const radSeedPath = path.join(__dirname, "data", "radicals-seed.json");
    if (fs.existsSync(radSeedPath)) {
      const radData = JSON.parse(fs.readFileSync(radSeedPath, "utf-8"));
      log(`Radicals table is empty — seeding ${radData.length} radicals…`);
      for (let i = 0; i < radData.length; i += 100) {
        await db.insert(radicals).values(radData.slice(i, i + 100)).onConflictDoNothing();
      }
      log("Radicals seeded.");
    } else {
      log("Warning: radicals-seed.json not found — skipping radical seed.");
    }
  } else {
    log(`Radicals table has ${radCount.value} entries — skipping radical seed.`);
  }

  // Check characters — seed if missing.
  const [charCount] = await db.select({ value: count() }).from(chineseCharacters);
  if (charCount.value > 0) {
    log(`Characters table has ${charCount.value} characters — skipping character seed.`);
    return;
  }

  const charSeedPath = path.join(__dirname, "data", "characters-seed.json");
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
