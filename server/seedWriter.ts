import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "./db";
import { sql } from "drizzle-orm";

export type SeedPatch = {
  definition?: string[];
  examples?: unknown;
  examplesTraditional?: unknown;
  wordExamples?: unknown;
  wordExamplesTraditional?: unknown;
  radicalIndex?: number | null;
  radicalIndexTraditional?: number | null;
};

/**
 * Patches one character entry in characters-seed.json and updates the stored
 * checksum so the next container restart does NOT re-upsert stale data.
 *
 * Errors are caught and logged — the DB update is already done before this
 * is called, so a seed-write failure is non-fatal.
 */
export async function patchCharacterInSeed(characterIndex: number, patch: SeedPatch): Promise<void> {
  const seedPath = path.join(process.cwd(), "server", "data", "characters-seed.json");
  try {
    const raw = fs.readFileSync(seedPath, "utf-8");
    const data: any[] = JSON.parse(raw);
    const idx = data.findIndex((c: any) => c.index === characterIndex);
    if (idx === -1) {
      console.warn(`seedWriter: character index ${characterIndex} not found in seed file`);
      return;
    }
    Object.assign(data[idx], patch);
    const updated = JSON.stringify(data);
    fs.writeFileSync(seedPath, updated, "utf-8");

    // Update stored checksum so autoSeed skips re-upsert on the next restart.
    // (The DB already has the correct values; the seed file now matches them.)
    const newChecksum = crypto
      .createHash("md5")
      .update(fs.readFileSync(seedPath))
      .digest("hex");
    await db.execute(sql`UPDATE app_config SET seed_checksum = ${newChecksum} WHERE id = 1`);
  } catch (err) {
    console.error("seedWriter: could not patch seed file (non-fatal):", err);
  }
}
