import { db } from "./db";
import { chineseCharacters, radicals } from "@shared/schema";
import { eq } from "drizzle-orm";

// Character seed data - extract radical information
const seedData = [
  { index: 0, radical: "白" }, { index: 1, radical: "一" }, { index: 2, radical: "日" },
  { index: 3, radical: "一" }, { index: 4, radical: "亅" }, { index: 5, radical: "土" },
  { index: 6, radical: "大" }, { index: 7, radical: "女" }, { index: 8, radical: "口" },
  { index: 9, radical: "人" }, { index: 10, radical: "冂" }, { index: 11, radical: "刂" },
  { index: 12, radical: "丶" }, { index: 13, radical: "个" }, { index: 14, radical: "人" },
  { index: 15, radical: "亠" }, { index: 16, radical: "人" }, { index: 17, radical: "刂" },
  { index: 18, radical: "人" }, { index: 19, radical: "八" }, { index: 20, radical: "冂" },
  { index: 21, radical: "八" }, { index: 22, radical: "八" }, { index: 23, radical: "冂" },
  { index: 24, radical: "八" }, { index: 25, radical: "冂" }, { index: 26, radical: "八" },
  { index: 27, radical: "刂" }, { index: 28, radical: "八" }, { index: 29, radical: "冂" },
  { index: 30, radical: "八" }, { index: 31, radical: "冂" }, { index: 32, radical: "八" },
  { index: 33, radical: "八" }, { index: 34, radical: "八" }, { index: 35, radical: "大" },
  { index: 36, radical: "八" }, { index: 37, radical: "刂" }, { index: 38, radical: "八" },
  { index: 39, radical: "八" }, { index: 40, radical: "八" }, { index: 41, radical: "八" },
  { index: 42, radical: "八" }, { index: 43, radical: "八" }, { index: 44, radical: "八" },
  { index: 45, radical: "八" }, { index: 46, radical: "冂" }, { index: 47, radical: "八" },
  { index: 48, radical: "八" }, { index: 49, radical: "八" }, { index: 50, radical: "八" }
];

async function populateRadicalIndex() {
  console.log('Populating radical index...');
  let updated = 0;
  
  for (const item of seedData) {
    const [radical] = await db
      .select()
      .from(radicals)
      .where(eq(radicals.simplified, item.radical));
    
    if (radical) {
      await db
        .update(chineseCharacters)
        .set({ radicalIndex: radical.index })
        .where(eq(chineseCharacters.index, item.index));
      updated++;
    }
  }
  
  console.log(`✓ Updated ${updated} characters with radical index`);
  process.exit(0);
}

populateRadicalIndex().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
