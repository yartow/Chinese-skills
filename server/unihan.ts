import fs from "fs";
import path from "path";

let cache: Record<string, number> | null = null;

function load(): Record<string, number> {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "server", "data", "kangxi-radicals.json");
  cache = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return cache!;
}

/** Returns the Kangxi radical number (1–214) for a character, or null if unknown. */
export function getKangxiRadicalNumber(char: string): number | null {
  const cp = char.codePointAt(0);
  if (cp == null) return null;
  const key = `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
  return load()[key] ?? null;
}
