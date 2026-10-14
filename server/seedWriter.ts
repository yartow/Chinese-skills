import fs from "fs";
import path from "path";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { seedChecksum } from "./autoSeed";
import type { CharacterUpdate } from "./storage";

export type SeedPatch = Omit<CharacterUpdate, "index">;

const charSeedPath = () => path.join(process.cwd(), "server", "data", "characters-seed.json");
const wordSeedPath = () => path.join(process.cwd(), "server", "data", "words-seed.json");

// Serialises read-modify-write cycles so concurrent requests can't clobber each other.
let queue: Promise<void> = Promise.resolve();

/**
 * Patches character entries in characters-seed.json and updates the stored
 * checksum so the next container restart does NOT re-upsert stale data.
 * The checksum covers the character AND word seed files, matching autoSeed.
 *
 * Errors are caught and logged — the DB update is already done before this
 * is called, so a seed-write failure is non-fatal.
 */
export function patchCharactersInSeed(patches: { index: number; patch: SeedPatch }[]): Promise<void> {
  queue = queue.then(async () => {
    if (patches.length === 0) return;
    try {
      const raw = await fs.promises.readFile(charSeedPath(), "utf-8");
      const data: any[] = JSON.parse(raw);
      const byIndex = new Map<number, any>(data.map((c) => [c.index, c]));
      for (const { index, patch } of patches) {
        const entry = byIndex.get(index);
        if (!entry) {
          console.warn(`seedWriter: character index ${index} not found in seed file`);
          continue;
        }
        // Drop undefined values so they don't erase existing seed fields.
        for (const [k, v] of Object.entries(patch)) {
          if (v !== undefined) entry[k] = v;
        }
      }
      await fs.promises.writeFile(charSeedPath(), JSON.stringify(data), "utf-8");

      // The DB already has the correct values; the seed file now matches them.
      const newChecksum = seedChecksum(charSeedPath(), wordSeedPath());
      await db.execute(sql`UPDATE app_config SET seed_checksum = ${newChecksum} WHERE id = 1`);
    } catch (err) {
      console.error("seedWriter: could not patch seed file (non-fatal):", err);
    }
  });
  return queue;
}

export function patchCharacterInSeed(characterIndex: number, patch: SeedPatch): Promise<void> {
  return patchCharactersInSeed([{ index: characterIndex, patch }]);
}
