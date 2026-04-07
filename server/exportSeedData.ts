import { db } from "./db";
import { chineseCharacters, chineseWords, radicals } from "@shared/schema";
import { asc } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportSeedData() {
  console.log("Exporting character data...");
  const chars = await db
    .select()
    .from(chineseCharacters)
    .orderBy(asc(chineseCharacters.index));
  console.log(`Exported ${chars.length} characters`);

  const rads = await db
    .select()
    .from(radicals)
    .orderBy(asc(radicals.index));
  console.log(`Exported ${rads.length} radicals`);

  const words = await db
    .select()
    .from(chineseWords)
    .orderBy(asc(chineseWords.id));
  const wordsWithExamples = words.filter(w => Array.isArray(w.examples) && (w.examples as unknown[]).length > 0).length;
  console.log(`Exported ${words.length} words (${wordsWithExamples} with examples)`);

  const outDir = path.join(__dirname, "data");
  fs.writeFileSync(
    path.join(outDir, "characters-seed.json"),
    JSON.stringify(chars, null, 0)
  );
  fs.writeFileSync(
    path.join(outDir, "radicals-seed.json"),
    JSON.stringify(rads, null, 0)
  );
  fs.writeFileSync(
    path.join(outDir, "words-seed.json"),
    JSON.stringify(words, null, 0)
  );
  console.log("Done. Files written to server/data/");
}

exportSeedData().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
