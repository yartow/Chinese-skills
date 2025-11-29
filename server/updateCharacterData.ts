import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { db } from "./db";
import { chineseCharacters } from "@shared/schema";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MakeHanziEntry {
  character: string;
  definition?: string;
  pinyin?: string[];
  radical?: string;
  etymology?: {
    type: string;
    hint: string;
  };
}

interface TatoebaSentence {
  english: string;
  chinese: string;
}

async function loadMakeHanziDictionary(): Promise<Map<string, MakeHanziEntry>> {
  const filePath = path.join(__dirname, "data", "makemeahanzi_dictionary.txt");
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  
  const dictionary = new Map<string, MakeHanziEntry>();
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as MakeHanziEntry;
      if (entry.character) {
        dictionary.set(entry.character, entry);
      }
    } catch (e) {
      // Skip malformed lines
    }
  }
  
  console.log(`Loaded ${dictionary.size} characters from Make Me a Hanzi dictionary`);
  return dictionary;
}

function loadTatoebaSentences(): TatoebaSentence[] {
  const filePath = path.join(__dirname, "data", "cmn.txt");
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  
  const sentences: TatoebaSentence[] = [];
  
  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length >= 2) {
      const english = parts[0].trim();
      const chinese = parts[1].trim();
      
      // Skip very short or very long sentences
      if (chinese.length >= 2 && chinese.length <= 30 && english.length >= 2 && english.length <= 100) {
        sentences.push({ english, chinese });
      }
    }
  }
  
  console.log(`Loaded ${sentences.length} sentence pairs from Tatoeba`);
  return sentences;
}

function buildCharacterSentenceIndex(sentences: TatoebaSentence[]): Map<string, TatoebaSentence[]> {
  const index = new Map<string, TatoebaSentence[]>();
  
  for (const sentence of sentences) {
    // Extract all unique characters from the Chinese sentence
    const chars = Array.from(new Set(sentence.chinese.split("")));
    
    for (const char of chars) {
      // Only index actual Chinese characters (Unicode range)
      if (char.charCodeAt(0) >= 0x4E00 && char.charCodeAt(0) <= 0x9FFF) {
        if (!index.has(char)) {
          index.set(char, []);
        }
        index.get(char)!.push(sentence);
      }
    }
  }
  
  console.log(`Built sentence index for ${index.size} unique characters`);
  return index;
}

function selectBestExamples(sentences: TatoebaSentence[], targetChar: string, count: number = 3): Array<{chinese: string; english: string}> {
  if (!sentences || sentences.length === 0) {
    return [];
  }
  
  // Sort sentences by length (prefer shorter, more focused examples)
  const sorted = [...sentences].sort((a, b) => a.chinese.length - b.chinese.length);
  
  // Select diverse examples (avoid duplicates, prefer variety)
  const selected: Array<{chinese: string; english: string}> = [];
  const seenEnglish = new Set<string>();
  
  for (const sentence of sorted) {
    if (selected.length >= count) break;
    
    // Skip if we've seen very similar English translation
    const normalizedEnglish = sentence.english.toLowerCase();
    if (seenEnglish.has(normalizedEnglish)) continue;
    
    selected.push({
      chinese: sentence.chinese,
      english: sentence.english
    });
    seenEnglish.add(normalizedEnglish);
  }
  
  return selected;
}

function cleanDefinition(def: string | undefined): string[] {
  if (!def) return [];
  
  // Split by comma or semicolon and clean up
  const parts = def.split(/[,;]/).map(p => p.trim()).filter(p => p.length > 0);
  
  // Limit to reasonable number of definitions
  return parts.slice(0, 6);
}

async function updateCharacterData() {
  console.log("Starting character data update...\n");
  
  // Load data sources
  const hanziDict = await loadMakeHanziDictionary();
  const sentences = loadTatoebaSentences();
  const sentenceIndex = buildCharacterSentenceIndex(sentences);
  
  // Get all characters from database
  const characters = await db.select().from(chineseCharacters).orderBy(chineseCharacters.index);
  console.log(`\nUpdating ${characters.length} characters in database...\n`);
  
  let updatedCount = 0;
  let definitionsImproved = 0;
  let examplesAdded = 0;
  
  for (const char of characters) {
    const simplified = char.simplified;
    const traditional = char.traditional;
    
    // Try to find in Make Me a Hanzi dictionary (prefer simplified, fallback to traditional)
    const hanziEntry = hanziDict.get(simplified) || hanziDict.get(traditional);
    
    // Get sentences for this character
    const charSentences = sentenceIndex.get(simplified) || sentenceIndex.get(traditional) || [];
    
    // Prepare updates
    let newDefinition = char.definition;
    let newExamples = char.examples;
    let needsUpdate = false;
    
    // Update definition if Make Me a Hanzi has a better one
    if (hanziEntry?.definition) {
      const cleanedDef = cleanDefinition(hanziEntry.definition);
      if (cleanedDef.length > 0) {
        // Check if current definition is poor (e.g., "meaning not available", "unofficial", single unclear word)
        const currentDefStr = Array.isArray(char.definition) ? char.definition.join("") : "";
        const isPoorDef = currentDefStr.includes("not available") || 
                          currentDefStr === "unofficial" ||
                          currentDefStr.length < 3 ||
                          (Array.isArray(char.definition) && char.definition.length === 1 && char.definition[0].length < 4);
        
        if (isPoorDef || cleanedDef.length > (Array.isArray(char.definition) ? char.definition.length : 0)) {
          newDefinition = cleanedDef;
          needsUpdate = true;
          definitionsImproved++;
        }
      }
    }
    
    // Update examples if we have real sentences from Tatoeba
    const examples = selectBestExamples(charSentences, simplified, 3);
    if (examples.length > 0) {
      // Check if current examples are template-based
      const currentExamplesStr = JSON.stringify(char.examples);
      const isTemplateBased = currentExamplesStr.includes("The character") || 
                              currentExamplesStr.includes(`Study ${simplified}`) ||
                              currentExamplesStr.includes(`This is ${simplified}`);
      
      if (isTemplateBased || examples.length >= 3) {
        newExamples = examples;
        needsUpdate = true;
        examplesAdded++;
      }
    }
    
    // Apply update if needed
    if (needsUpdate) {
      await db.update(chineseCharacters)
        .set({
          definition: newDefinition,
          examples: newExamples
        })
        .where(eq(chineseCharacters.index, char.index));
      
      updatedCount++;
      
      // Log progress every 100 characters
      if (updatedCount % 100 === 0) {
        console.log(`Updated ${updatedCount} characters...`);
      }
    }
  }
  
  console.log("\n=== Update Complete ===");
  console.log(`Total characters updated: ${updatedCount}`);
  console.log(`Definitions improved: ${definitionsImproved}`);
  console.log(`Examples added from Tatoeba: ${examplesAdded}`);
}

updateCharacterData()
  .then(() => {
    console.log("\nCharacter data update finished successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error updating character data:", error);
    process.exit(1);
  });
