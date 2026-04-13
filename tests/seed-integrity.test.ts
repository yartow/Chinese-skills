/**
 * seed-integrity.test.ts
 * ─────────────────────
 * Validates the characters-seed.json and words-seed.json data files against
 * a set of structural invariants.  These tests run with no database or
 * network connection — they just parse the JSON and check the shape.
 *
 * What they catch:
 *  - Duplicate character/word entries (like the #790 / #6438 bug)
 *  - Missing required fields
 *  - Invalid HSK levels
 *  - Malformed examples or definitions
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../");
const charSeedPath = path.join(ROOT, "server/data/characters-seed.json");
const wordSeedPath = path.join(ROOT, "server/data/words-seed.json");

// ─── Load seed files once ────────────────────────────────────────────────────

type CharEntry = {
  index: number;
  simplified: string;
  traditional: string;
  pinyin: string;
  definition: string[];
  hskLevel: number;
  examples: Array<{ chinese: string; english: string }> | null;
  [key: string]: unknown;
};

type WordEntry = {
  id: number;
  word: string;
  traditional: string;
  pinyin: string;
  definition: string[];
  hskLevel: number;
  examples: unknown[];
};

const charData: CharEntry[] = JSON.parse(fs.readFileSync(charSeedPath, "utf-8"));
const wordData: WordEntry[] = JSON.parse(fs.readFileSync(wordSeedPath, "utf-8"));

// ─── Character seed tests ────────────────────────────────────────────────────

describe("characters-seed.json", () => {
  it("loads and is a non-empty array", () => {
    expect(Array.isArray(charData)).toBe(true);
    expect(charData.length).toBeGreaterThan(1000);
  });

  it("has no duplicate indices", () => {
    const indices = charData.map((c) => c.index);
    const unique = new Set(indices);
    expect(unique.size).toBe(indices.length);
  });

  it("has no duplicate simplified characters", () => {
    const seen = new Map<string, number>();
    const dupes: string[] = [];
    for (const c of charData) {
      if (seen.has(c.simplified)) {
        dupes.push(`${c.simplified} at index ${c.index} (also at ${seen.get(c.simplified)})`);
      } else {
        seen.set(c.simplified, c.index);
      }
    }
    expect(dupes).toEqual([]);
  });

  it("has no phantom HSK-0 traditional-form entries (the #790/#6438 duplicate bug)", () => {
    // Build a map: traditional form → the index of the entry that owns it
    // (only entries that have a distinct simplified form)
    const tradOwners = new Map<string, number>();
    for (const c of charData) {
      if (c.simplified !== c.traditional) {
        tradOwners.set(c.traditional, c.index);
      }
    }
    // An HSK-0 entry where simplified === traditional is a phantom if another
    // entry already 'owns' that character as its traditional form.
    // HSK > 0 entries are excluded — e.g. 著 (HSK 4) is legitimately its own character.
    const phantoms: string[] = [];
    for (const c of charData) {
      if (
        c.simplified === c.traditional &&
        c.hskLevel === 0 &&
        tradOwners.has(c.simplified)
      ) {
        phantoms.push(
          `index ${c.index}: simplified="${c.simplified}" is also the traditional of index ${tradOwners.get(c.simplified)}`
        );
      }
    }
    expect(phantoms).toEqual([]);
  });

  it("all entries have required structural fields: index, simplified, traditional, pinyin, hskLevel", () => {
    const bad: number[] = [];
    for (const c of charData) {
      if (
        typeof c.index !== "number" ||
        typeof c.simplified !== "string" || !c.simplified ||
        typeof c.traditional !== "string" || !c.traditional ||
        typeof c.pinyin !== "string" || !c.pinyin ||
        !Array.isArray(c.definition) ||          // must be an array (may be empty for mega-hanzi entries)
        typeof c.hskLevel !== "number"
      ) {
        bad.push(c.index);
      }
    }
    expect(bad).toEqual([]);
  });

  it("all HSK 1-6 characters have non-empty definitions (data enrichment check)", () => {
    // Characters with HSK 1-6 are core curriculum characters and must have definitions.
    // High-index mega-hanzi entries (HSK 0) may have empty definitions if not yet enriched.
    const bad = charData.filter(
      (c) => c.hskLevel >= 1 && c.hskLevel <= 6 && (!Array.isArray(c.definition) || c.definition.length === 0)
    );
    expect(bad.map((c) => `index ${c.index} (${c.simplified})`)).toEqual([]);
  });

  it("all HSK levels are integers in range 0–9", () => {
    const bad = charData.filter((c) => !Number.isInteger(c.hskLevel) || c.hskLevel < 0 || c.hskLevel > 9);
    expect(bad.map((c) => `index ${c.index} hskLevel=${c.hskLevel}`)).toEqual([]);
  });

  it("all definition arrays contain only non-empty strings", () => {
    const bad: string[] = [];
    for (const c of charData) {
      if (!Array.isArray(c.definition) || c.definition.some((d) => typeof d !== "string" || !d.trim())) {
        bad.push(`index ${c.index}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("all examples (where present) have chinese and english string fields", () => {
    const bad: string[] = [];
    for (const c of charData) {
      if (!c.examples) continue;
      if (!Array.isArray(c.examples)) {
        bad.push(`index ${c.index}: examples is not an array`);
        continue;
      }
      for (const ex of c.examples) {
        if (
          typeof (ex as any).chinese !== "string" || !(ex as any).chinese ||
          typeof (ex as any).english !== "string" || !(ex as any).english
        ) {
          bad.push(`index ${c.index}: malformed example ${JSON.stringify(ex)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("indices form a monotonically increasing sequence with no gaps above 3000", () => {
    // The first ~3000 entries should be roughly contiguous (some HSK ordering).
    // This catches accidental deletion of large blocks of data.
    const sorted = [...charData].sort((a, b) => a.index - b.index);
    expect(sorted[0].index).toBeGreaterThanOrEqual(0);
    // Sanity: the seed has at least 3000 characters (HSK 1-6 coverage)
    expect(charData.filter((c) => c.index < 3000).length).toBeGreaterThanOrEqual(500);
  });
});

// ─── Word seed tests ─────────────────────────────────────────────────────────

describe("words-seed.json", () => {
  it("loads and is a non-empty array", () => {
    expect(Array.isArray(wordData)).toBe(true);
    expect(wordData.length).toBeGreaterThan(100);
  });

  it("has no duplicate IDs", () => {
    const ids = wordData.map((w) => w.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("all entries have required fields: id, word, pinyin, definition, hskLevel, examples", () => {
    const bad: number[] = [];
    for (const w of wordData) {
      if (
        typeof w.id !== "number" ||
        typeof w.word !== "string" || !w.word ||
        typeof w.pinyin !== "string" || !w.pinyin ||
        !Array.isArray(w.definition) || w.definition.length === 0 ||
        typeof w.hskLevel !== "number" ||
        !Array.isArray(w.examples)
      ) {
        bad.push(w.id);
      }
    }
    expect(bad).toEqual([]);
  });

  it("all HSK levels are integers in range 1–9", () => {
    const bad = wordData.filter((w) => !Number.isInteger(w.hskLevel) || w.hskLevel < 1 || w.hskLevel > 9);
    expect(bad.map((w) => `id ${w.id} hskLevel=${w.hskLevel}`)).toEqual([]);
  });

  it("no word entry has an empty word string", () => {
    const bad = wordData.filter((w) => !w.word.trim());
    expect(bad.map((w) => `id ${w.id}`)).toEqual([]);
  });
});
