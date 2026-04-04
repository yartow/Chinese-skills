/**
 * validateExamples.ts
 *
 * Task A: Find every row where at least one example sentence does NOT contain
 * the character it is supposed to illustrate.
 *
 * Checks four fields:
 *   examples                 — each { chinese } must contain `simplified`
 *   examples_traditional     — each { chinese } must contain `traditional`
 *   word_examples            — each { word }    must contain `simplified`
 *   word_examples_traditional— each { word }    must contain `traditional`
 *
 * Run:
 *   npx tsx server/validateExamples.ts
 */

import { db, pool } from "./db";
import { chineseCharacters } from "@shared/schema";

interface ExampleEntry {
  chinese?: string;
  english?: string;
}

interface WordExampleEntry {
  word?: string;
  pinyin?: string;
  meaning?: string;
}

interface BadSentence {
  field: string;
  sentence: string;
  expected: string;
}

interface BadRow {
  index: number;
  simplified: string;
  traditional: string;
  issues: BadSentence[];
}

function checkExamples(
  examples: ExampleEntry[] | null | undefined,
  character: string,
  fieldName: string,
): BadSentence[] {
  if (!examples || !Array.isArray(examples)) return [];
  const bad: BadSentence[] = [];
  for (const ex of examples) {
    const sentence = ex.chinese ?? "";
    if (sentence && !sentence.includes(character)) {
      bad.push({ field: fieldName, sentence, expected: character });
    }
  }
  return bad;
}

function checkWordExamples(
  examples: WordExampleEntry[] | null | undefined,
  character: string,
  fieldName: string,
): BadSentence[] {
  if (!examples || !Array.isArray(examples)) return [];
  const bad: BadSentence[] = [];
  for (const ex of examples) {
    const word = ex.word ?? "";
    if (word && !word.includes(character)) {
      bad.push({ field: fieldName, sentence: word, expected: character });
    }
  }
  return bad;
}

async function validate() {
  console.log("Loading all characters...\n");

  const rows = await db.select().from(chineseCharacters);
  console.log(`Total rows: ${rows.length}\n`);

  const badRows: BadRow[] = [];

  for (const row of rows) {
    const issues: BadSentence[] = [
      ...checkExamples(
        row.examples as ExampleEntry[],
        row.simplified,
        "examples",
      ),
      ...checkExamples(
        row.examplesTraditional as ExampleEntry[],
        row.traditional,
        "examples_traditional",
      ),
      ...checkWordExamples(
        row.wordExamples as WordExampleEntry[],
        row.simplified,
        "word_examples",
      ),
      ...checkWordExamples(
        row.wordExamplesTraditional as WordExampleEntry[],
        row.traditional,
        "word_examples_traditional",
      ),
    ];

    if (issues.length > 0) {
      badRows.push({
        index: row.index,
        simplified: row.simplified,
        traditional: row.traditional,
        issues,
      });
    }
  }

  if (badRows.length === 0) {
    console.log("No issues found — all sentences contain their target character.");
    await pool.end();
    return;
  }

  console.log(`Found ${badRows.length} row(s) with broken sentences:\n`);
  console.log("=".repeat(72));

  for (const row of badRows) {
    console.log(
      `\nIndex ${row.index}  simplified=${row.simplified}  traditional=${row.traditional}`,
    );
    for (const issue of row.issues) {
      console.log(
        `  [${issue.field}]  expected "${issue.expected}" in: "${issue.sentence}"`,
      );
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log(`\nSummary: ${badRows.length} row(s) affected.`);

  // Breakdown by field
  const fieldCounts: Record<string, number> = {};
  for (const row of badRows) {
    for (const issue of row.issues) {
      fieldCounts[issue.field] = (fieldCounts[issue.field] ?? 0) + 1;
    }
  }
  for (const [field, count] of Object.entries(fieldCounts)) {
    console.log(`  ${field}: ${count} bad sentence(s)`);
  }

  await pool.end();
}

validate().catch((err) => {
  console.error(err);
  process.exit(1);
});
