import XLSX from "xlsx";
import * as path from "path";
import { fileURLToPath } from "url";
import { db } from "./db";
import { chineseCharacters } from "@shared/schema";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ExcelRow {
  index: number;
  simplified: string;
  traditional: string;
  pinyin: string;
  definition: string;
  examples: string;
  hsk_level: number;
  traditional_variants: string | null;
  radical_index: number | null;
  pinyin2: string | null;
  pinyin3: string | null;
  numbered_pinyin: string | null;
  numbered_pinyin2: string | null;
  numbered_pinyin3: string | null;
}

function parseJsonField<T>(value: string | null | undefined, defaultValue: T): T {
  if (!value || value === "null" || value === "") {
    return defaultValue;
  }
  try {
    return JSON.parse(value) as T;
  } catch (e) {
    console.warn(`Failed to parse JSON: ${value}`);
    return defaultValue;
  }
}

async function importExcelData() {
  console.log("Starting Excel data import...\n");

  const excelPath = path.join(__dirname, "..", "attached_assets", "chinese_characters3_1765814172081.xlsx");
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Read as array of arrays first
  const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  const headers = rawData[0] as string[];
  
  console.log(`Found ${rawData.length - 1} rows to import`);
  console.log(`Headers: ${headers.join(", ")}\n`);

  let updatedCount = 0;
  let errorCount = 0;

  // Process each row (skip header)
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i] as any[];
    
    try {
      const index = row[0] as number;
      const simplified = row[1] as string;
      const traditional = row[2] as string;
      const pinyin = row[3] as string;
      const definitionRaw = row[4] as string;
      const examplesRaw = row[5] as string;
      const hskLevel = row[6] as number;
      const traditionalVariantsRaw = row[7] as string | null;
      const radicalIndex = row[8] as number | null;
      const pinyin2 = row[9] as string | null;
      const pinyin3 = row[10] as string | null;
      const numberedPinyin = row[11] as string | null;
      const numberedPinyin2 = row[12] as string | null;
      const numberedPinyin3 = row[13] as string | null;

      // Parse JSON fields
      const definition = parseJsonField<string[]>(definitionRaw, []);
      const examples = parseJsonField<Array<{chinese: string; english: string}>>(examplesRaw, []);
      const traditionalVariants = parseJsonField<string[] | null>(traditionalVariantsRaw, null);

      // Update the database
      await db.update(chineseCharacters)
        .set({
          simplified: simplified || undefined,
          traditional: traditional || undefined,
          pinyin: pinyin || undefined,
          definition: definition.length > 0 ? definition : undefined,
          examples: examples.length > 0 ? examples : undefined,
          hskLevel: hskLevel || undefined,
          traditionalVariants: traditionalVariants,
          radicalIndex: radicalIndex,
          pinyin2: pinyin2 || null,
          pinyin3: pinyin3 || null,
          numberedPinyin: numberedPinyin || null,
          numberedPinyin2: numberedPinyin2 || null,
          numberedPinyin3: numberedPinyin3 || null,
        })
        .where(eq(chineseCharacters.index, index));

      updatedCount++;
      
      if (updatedCount % 500 === 0) {
        console.log(`Updated ${updatedCount} characters...`);
      }
    } catch (error) {
      errorCount++;
      console.error(`Error updating row ${i}: ${error}`);
    }
  }

  console.log("\n=== Import Complete ===");
  console.log(`Total characters updated: ${updatedCount}`);
  console.log(`Errors: ${errorCount}`);
}

importExcelData()
  .then(() => {
    console.log("\nExcel data import finished successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error importing Excel data:", error);
    process.exit(1);
  });
