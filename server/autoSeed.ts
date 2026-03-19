import { db } from "./db";
import { chineseCharacters, radicals } from "@shared/schema";
import { count } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function ensureDataSeeded(log: (msg: string) => void) {
  // Check if characters already loaded
  const [charCount] = await db.select({ value: count() }).from(chineseCharacters);
  if (charCount.value > 0) {
    log(`Database already has ${charCount.value} characters — skipping seed.`);
    return;
  }

  log("Characters table is empty — seeding from bundled data…");

  // Seed radicals first (characters have a FK to radicals via radicalIndex)
  const radSeedPath = path.join(__dirname, "data", "radicals-seed.json");
  if (fs.existsSync(radSeedPath)) {
    const radData = JSON.parse(fs.readFileSync(radSeedPath, "utf-8"));
    log(`Seeding ${radData.length} radicals…`);
    for (let i = 0; i < radData.length; i += 100) {
      await db.insert(radicals).values(radData.slice(i, i + 100)).onConflictDoNothing();
    }
    log("Radicals seeded.");
  } else {
    log("Warning: radicals-seed.json not found — skipping radical seed.");
  }

  // Seed characters in batches of 100
  const charSeedPath = path.join(__dirname, "data", "characters-seed.json");
  if (!fs.existsSync(charSeedPath)) {
    log("Warning: characters-seed.json not found — cannot seed characters.");
    return;
  }

  const charData = JSON.parse(fs.readFileSync(charSeedPath, "utf-8"));
  log(`Seeding ${charData.length} characters in batches…`);

  for (let i = 0; i < charData.length; i += 100) {
    const batch = charData.slice(i, i + 100);
    await db.insert(chineseCharacters).values(batch).onConflictDoNothing();
    if (i % 500 === 0) log(`  …inserted up to index ${i + 100}`);
  }

  const [newCount] = await db.select({ value: count() }).from(chineseCharacters);
  log(`Seeding complete — ${newCount.value} characters in database.`);
}
