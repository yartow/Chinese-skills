import { db } from "./db";
import { chineseCharacters } from "@shared/schema";
import { sql } from "drizzle-orm";
import fs from 'fs';
import { parse } from 'csv-parse/sync';

// Parse HSK CSV data using proper CSV parser
function parseHSKCSV(): any[] {
  const csvPath = '/tmp/hsk_characters.csv';
  const content = fs.readFileSync(csvPath, 'utf-8');
  
  // Parse CSV with proper handling of quoted fields
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  
  const characters: any[] = [];
  
  for (const record of records) {
    // Handle traditional character variants (e.g., "準准" or "驩讙歡")
    const tradField = record.hanzi_trad || record.hanzi_sc || '';
    const tradArray = Array.from(tradField);
    const traditional = tradArray[0] || record.hanzi_sc || '';
    const traditionalVariants = tradArray.length > 1 
      ? tradArray.slice(1).filter((v, i, arr) => arr.indexOf(v) === i && v !== traditional)
      : [];
    
    characters.push({
      simplified: record.hanzi_sc || '',
      traditional,
      traditionalVariants,
      pinyin: record.pinyin || '',
      level: record.level || '1', // HSK level
      definitions: record.cc_cedict_definitions || record.hanzi_sc,
    });
  }
  
  console.log(`Parsed ${characters.length} total characters from HSK dataset`);
  return characters;
}

// Common radicals with pinyin
const radicalMap: Record<string, { radical: string; pinyin: string }> = {
  '的': { radical: '白', pinyin: 'bái' },
  '了': { radical: '亅', pinyin: 'jué' },
  '在': { radical: '土', pinyin: 'tǔ' },
  '是': { radical: '日', pinyin: 'rì' },
  '我': { radical: '戈', pinyin: 'gē' },
  '一': { radical: '一', pinyin: 'yī' },
  '有': { radical: '月', pinyin: 'yuè' },
  '他': { radical: '人', pinyin: 'rén' },
  '这': { radical: '辶', pinyin: 'chuò' },
  '中': { radical: '丨', pinyin: 'gǔn' },
  '大': { radical: '大', pinyin: 'dà' },
  '来': { radical: '木', pinyin: 'mù' },
  '上': { radical: '一', pinyin: 'yī' },
  '国': { radical: '囗', pinyin: 'wéi' },
  '个': { radical: '人', pinyin: 'rén' },
  '到': { radical: '刀', pinyin: 'dāo' },
  '说': { radical: '言', pinyin: 'yán' },
  '们': { radical: '人', pinyin: 'rén' },
  '为': { radical: '丶', pinyin: 'zhǔ' },
  '子': { radical: '子', pinyin: 'zǐ' },
  '和': { radical: '口', pinyin: 'kǒu' },
  '你': { radical: '人', pinyin: 'rén' },
  '地': { radical: '土', pinyin: 'tǔ' },
  '出': { radical: '凵', pinyin: 'kǎn' },
  '道': { radical: '辶', pinyin: 'chuò' },
  '也': { radical: '乙', pinyin: 'yǐ' },
  '时': { radical: '日', pinyin: 'rì' },
  '年': { radical: '干', pinyin: 'gān' },
  '得': { radical: '彳', pinyin: 'chì' },
  '就': { radical: '尢', pinyin: 'yóu' },
  '那': { radical: '邑', pinyin: 'yì' },
  '要': { radical: '西', pinyin: 'xī' },
  '下': { radical: '一', pinyin: 'yī' },
  '以': { radical: '人', pinyin: 'rén' },
  '生': { radical: '生', pinyin: 'shēng' },
  '会': { radical: '人', pinyin: 'rén' },
  '自': { radical: '自', pinyin: 'zì' },
  '着': { radical: '目', pinyin: 'mù' },
  '去': { radical: '厶', pinyin: 'sī' },
  '之': { radical: '丶', pinyin: 'zhǔ' },
  '过': { radical: '辶', pinyin: 'chuò' },
  '家': { radical: '宀', pinyin: 'mián' },
  '学': { radical: '子', pinyin: 'zǐ' },
  '对': { radical: '寸', pinyin: 'cùn' },
  '可': { radical: '口', pinyin: 'kǒu' },
  '她': { radical: '女', pinyin: 'nǚ' },
  '里': { radical: '里', pinyin: 'lǐ' },
  '后': { radical: '口', pinyin: 'kǒu' },
  '小': { radical: '小', pinyin: 'xiǎo' },
  '么': { radical: '丿', pinyin: 'piě' },
  '心': { radical: '心', pinyin: 'xīn' },
  '多': { radical: '夕', pinyin: 'xī' },
  '天': { radical: '大', pinyin: 'dà' },
  '而': { radical: '而', pinyin: 'ér' },
  '能': { radical: '肉', pinyin: 'ròu' },
  '好': { radical: '女', pinyin: 'nǚ' },
  '都': { radical: '邑', pinyin: 'yì' },
  '然': { radical: '火', pinyin: 'huǒ' },
  '没': { radical: '水', pinyin: 'shuǐ' },
  '日': { radical: '日', pinyin: 'rì' },
  '于': { radical: '二', pinyin: 'èr' },
  '起': { radical: '走', pinyin: 'zǒu' },
  '还': { radical: '辶', pinyin: 'chuò' },
  '发': { radical: '又', pinyin: 'yòu' },
  '成': { radical: '戈', pinyin: 'gē' },
  '事': { radical: '亅', pinyin: 'jué' },
  '只': { radical: '口', pinyin: 'kǒu' },
  '作': { radical: '人', pinyin: 'rén' },
  '当': { radical: '小', pinyin: 'xiǎo' },
  '想': { radical: '心', pinyin: 'xīn' },
  '看': { radical: '目', pinyin: 'mù' },
  '文': { radical: '文', pinyin: 'wén' },
  '无': { radical: '无', pinyin: 'wú' },
  '开': { radical: '廾', pinyin: 'gǒng' },
  '手': { radical: '手', pinyin: 'shǒu' },
  '十': { radical: '十', pinyin: 'shí' },
  '用': { radical: '用', pinyin: 'yòng' },
  '主': { radical: '丶', pinyin: 'zhǔ' },
  '行': { radical: '行', pinyin: 'háng' },
  '方': { radical: '方', pinyin: 'fāng' },
  '又': { radical: '又', pinyin: 'yòu' },
  '如': { radical: '女', pinyin: 'nǚ' },
  '前': { radical: '刀', pinyin: 'dāo' },
  '所': { radical: '戶', pinyin: 'hù' },
  '本': { radical: '木', pinyin: 'mù' },
  '见': { radical: '见', pinyin: 'jiàn' },
  '经': { radical: '糸', pinyin: 'mì' },
  '头': { radical: '大', pinyin: 'dà' },
  '面': { radical: '面', pinyin: 'miàn' },
  '公': { radical: '八', pinyin: 'bā' },
  '同': { radical: '口', pinyin: 'kǒu' },
  '三': { radical: '一', pinyin: 'yī' },
  '已': { radical: '己', pinyin: 'jǐ' },
  '老': { radical: '老', pinyin: 'lǎo' },
  '从': { radical: '人', pinyin: 'rén' },
  '动': { radical: '力', pinyin: 'lì' },
  '两': { radical: '一', pinyin: 'yī' },
  '长': { radical: '长', pinyin: 'cháng' },
  '把': { radical: '手', pinyin: 'shǒu' },
  '内': { radical: '冂', pinyin: 'jiōng' },
  '民': { radical: '氏', pinyin: 'shì' },
  '全': { radical: '人', pinyin: 'rén' },
};

// Helper function to get radical info
function getRadicalInfo(char: string): { radical: string; pinyin: string } {
  return radicalMap[char] || { radical: char, pinyin: 'unknown' };
}

// Helper function to clean and parse definitions
function parseDefinitions(rawDef: string): string[] {
  if (!rawDef) return ['meaning not available'];
  
  // Remove common patterns
  let cleaned = rawDef
    .replace(/\([^)]*\)/g, '') // Remove parentheses content
    .replace(/\[[^\]]*\]/g, '') // Remove bracket content  
    .replace(/variant of [^\/;]*/gi, '') // Remove "variant of" references
    .replace(/"[^"]*"/g, ''); // Remove quoted content
  
  // Split by semicolon or slash
  const defs = cleaned
    .split(/[;\/]/)
    .map(d => d.trim())
    .filter(d => d && d.length > 0 && d.length < 80)
    .slice(0, 3);
  
  return defs.length > 0 ? defs : ['meaning not available'];
}

// Generate simple example sentences
function generateExamples(char: string, pinyin: string): Array<{ chinese: string; english: string }> {
  const examples = [
    { chinese: char, english: `The character ${char}` },
    { chinese: `学${char}`, english: `Study ${char}` },
    { chinese: `这是${char}`, english: `This is ${char}` },
  ];
  
  return examples;
}

export async function reseedCharacters() {
  try {
    console.log('Deleting existing characters...');
    await db.delete(chineseCharacters);
    
    console.log('Parsing HSK character data...');
    const hskChars = parseHSKCSV();
    
    console.log(`Preparing ${hskChars.length} characters for insertion...`);
    
    const characterData = hskChars.map((hsk, index) => {
      const radicalInfo = getRadicalInfo(hsk.simplified);
      const definitions = parseDefinitions(hsk.definitions);
      const examples = generateExamples(hsk.simplified, hsk.pinyin);
      
      // Parse HSK level - map levels to 1-6 range
      // HSK 3.0 has levels 1-9, but we'll normalize to 1-6
      let hskLevel = parseInt(hsk.level) || 1;
      if (hskLevel > 6) {
        hskLevel = 6; // Map higher levels to level 6
      }
      
      return {
        index,
        simplified: hsk.simplified,
        traditional: hsk.traditional,
        traditionalVariants: hsk.traditionalVariants || [],
        pinyin: hsk.pinyin,
        radical: radicalInfo.radical,
        radicalPinyin: radicalInfo.pinyin,
        definition: definitions,
        examples,
        hskLevel,
      };
    });
    
    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < characterData.length; i += batchSize) {
      const batch = characterData.slice(i, i + batchSize);
      await db.insert(chineseCharacters).values(batch);
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(characterData.length / batchSize)}`);
    }
    
    console.log('Character reseeding complete!');
  } catch (error) {
    console.error('Error reseeding characters:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  reseedCharacters()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
