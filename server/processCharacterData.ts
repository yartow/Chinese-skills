import fs from 'fs';
import path from 'path';

interface HSKCharacter {
  hanzi_sc: string;
  hanzi_trad: string;
  pinyin: string;
  pinyin_style2: string;
  level: string;
  level_zh: string;
  cc_cedict_definitions: string;
}

interface MakeHanziCharacter {
  character: string;
  definition?: string;
  pinyin?: string[];
  radical?: string;
  decomposition?: string;
  etymology?: {
    type?: string;
    hint?: string;
    phonetic?: string;
    semantic?: string;
  };
}

interface ProcessedCharacter {
  index: number;
  simplified: string;
  traditional: string;
  pinyin: string;
  radical: string;
  radicalPinyin: string;
  definition: string[];
  examples: Array<{ chinese: string; english: string }>;
}

// Simple example sentence generator based on character
function generateExamples(char: string, pinyin: string, definitions: string[]): Array<{ chinese: string; english: string }> {
  // Common sentence patterns for different characters
  const examples: Array<{ chinese: string; english: string }> = [];
  
  // Add 3-5 contextual examples
  examples.push({ chinese: `${char}`, english: definitions[0] || char });
  
  return examples;
}

// Parse HSK CSV data
function parseHSKCSV(csvPath: string): HSKCharacter[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj as HSKCharacter;
  });
}

// Parse Make Me a Hanzi dictionary
function parseMakeHanzi(jsonlPath: string): Map<string, MakeHanziCharacter> {
  const content = fs.readFileSync(jsonlPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const map = new Map<string, MakeHanziCharacter>();
  
  for (const line of lines) {
    try {
      const data = JSON.parse(line) as MakeHanziCharacter;
      if (data.character) {
        map.set(data.character, data);
      }
    } catch (e) {
      // Skip invalid lines
    }
  }
  
  return map;
}

// Common radicals with pinyin
const commonRadicals: Record<string, string> = {
  '人': 'rén', '亻': 'rén', '⺅': 'rén',
  '口': 'kǒu',
  '手': 'shǒu', '扌': 'shǒu',
  '水': 'shuǐ', '氵': 'shuǐ',
  '心': 'xīn', '忄': 'xīn',
  '木': 'mù',
  '火': 'huǒ', '灬': 'huǒ',
  '土': 'tǔ',
  '金': 'jīn', '钅': 'jīn',
  '日': 'rì',
  '月': 'yuè',
  '言': 'yán', '讠': 'yán',
  '竹': 'zhú', '⺮': 'zhú',
  '糸': 'mì', '纟': 'mì',
  '艹': 'cǎo',
  '辶': 'chuò',
  '阝': 'fù',
  '女': 'nǚ',
  '子': 'zǐ',
  '目': 'mù',
  '田': 'tián',
  '石': 'shí',
  '禾': 'hé',
  '白': 'bái',
  '皮': 'pí',
  '矢': 'shǐ',
  '一': 'yī',
  '丨': 'gǔn',
  '丶': 'zhǔ',
  '丿': 'piě',
  '乙': 'yǐ',
  '亅': 'jué',
  '二': 'èr',
  '亠': 'tóu',
  '几': 'jǐ',
  '凵': 'kǎn',
  '刀': 'dāo', '刂': 'dāo',
  '力': 'lì',
  '又': 'yòu',
  '廴': 'yǐn',
  '工': 'gōng',
  '巾': 'jīn',
  '大': 'dà',
  '彡': 'shān',
  '夕': 'xī',
  '小': 'xiǎo',
  '广': 'guǎng',
  '走': 'zǒu', '⻍': 'zǒu',
  '足': 'zú',
  '酉': 'yǒu',
  '貝': 'bèi', '贝': 'bèi',
  '車': 'chē', '车': 'chē',
  '門': 'mén', '门': 'mén',
  '頁': 'yè', '页': 'yè',
  '馬': 'mǎ', '马': 'mǎ',
  '鳥': 'niǎo', '鸟': 'niǎo',
  '魚': 'yú', '鱼': 'yú',
  '戈': 'gē',
  '攴': 'pū',
  '文': 'wén',
  '方': 'fāng',
  '无': 'wú',
  '玉': 'yù', '王': 'wáng',
  '示': 'shì', '礻': 'shì',
  '衣': 'yī', '衤': 'yī',
  '雨': 'yǔ',
  '食': 'shí', '飠': 'shí', '饣': 'shí',
  '囗': 'wéi',
};

// Get radical pinyin
function getRadicalPinyin(radical: string): string {
  return commonRadicals[radical] || 'unknown';
}

// Process all character data
export async function processCharacterData(): Promise<ProcessedCharacter[]> {
  const hskPath = '/tmp/hsk_characters.csv';
  const hanziPath = '/tmp/hanzi_data.txt';
  
  console.log('Parsing HSK data...');
  const hskChars = parseHSKCSV(hskPath);
  
  console.log('Parsing Make Me a Hanzi data...');
  const hanziMap = parseMakeHanzi(hanziPath);
  
  console.log(`Processing ${Math.min(2500, hskChars.length)} characters...`);
  
  const processedChars: ProcessedCharacter[] = [];
  
  for (let i = 0; i < Math.min(2500, hskChars.length); i++) {
    const hsk = hskChars[i];
    const hanzi = hanziMap.get(hsk.hanzi_sc);
    
    // Get radical
    let radical = hanzi?.radical || hsk.hanzi_sc[0] || '？';
    const radicalPinyin = getRadicalPinyin(radical);
    
    // Parse definitions
    let definitions: string[] = [];
    if (hsk.cc_cedict_definitions) {
      // Split by semicolon or slash, clean up
      const rawDefs = hsk.cc_cedict_definitions
        .split(/[;\/]/)
        .map(d => d.trim())
        .filter(d => d && !d.startsWith('(') && d.length < 100)
        .slice(0, 3);
      definitions = rawDefs.length > 0 ? rawDefs : [hsk.hanzi_sc];
    } else {
      definitions = [hsk.hanzi_sc];
    }
    
    // Generate simple examples
    const examples = generateExamples(hsk.hanzi_sc, hsk.pinyin, definitions);
    
    processedChars.push({
      index: i,
      simplified: hsk.hanzi_sc,
      traditional: hsk.hanzi_trad || hsk.hanzi_sc,
      pinyin: hsk.pinyin,
      radical,
      radicalPinyin,
      definition: definitions,
      examples,
    });
  }
  
  return processedChars;
}

// Write processed data to JSON file
export async function writeProcessedData() {
  const chars = await processCharacterData();
  const outputPath = path.join(process.cwd(), 'server', 'processed_characters.json');
  fs.writeFileSync(outputPath, JSON.stringify(chars, null, 2), 'utf-8');
  console.log(`Wrote ${chars.length} characters to ${outputPath}`);
  return chars;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  writeProcessedData()
    .then(() => {
      console.log('Processing complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}
