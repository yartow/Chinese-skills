import { db } from "./db";
import { chineseCharacters, radicals } from "@shared/schema";
import { eq } from "drizzle-orm";
import fs from "fs";

// Comprehensive radical variant normalization map
// Maps variant forms to their standard 214 Kangxi radical forms
const radicalVariantMap: Record<string, string> = {
  // Person variants
  '亻': '人', '⺅': '人', '𠆢': '人',
  // Water variants
  '氵': '水', '氺': '水', '⺢': '水',
  // Heart variants
  '忄': '心', '⺗': '心', '㣺': '心',
  // Hand variants
  '扌': '手', '龵': '手', '⺘': '手',
  // Fire variants
  '灬': '火', '⺣': '火',
  // Knife variants
  '刂': '刀', '⺉': '刀', '⺈': '刀',
  // Gold/Metal variants
  '钅': '金', '釒': '金', '⻐': '金',
  // Speech variants
  '讠': '言', '訁': '言', '⻈': '言',
  // Silk variants
  '纟': '糸', '糹': '糸', '⺓': '糸', '⺔': '糸',
  // Food variants
  '饣': '食', '飠': '食', '⻞': '食',
  // Grass/Plant variants
  '艹': '艸', '⺿': '艸', '⻀': '艸', '⺾': '艸', '⻃': '艸',
  // Walk/Movement variants
  '辶': '辵', '⻍': '辵', '⻌': '辵', '⻎': '辵',
  // City/Place variants (right)
  '阝': '邑', '⻏': '邑',
  // Mound/Hill variants (left)
  '阝': '阜', '⻖': '阜',
  // Dog variants
  '犭': '犬', '⺨': '犬',
  // Jade variants
  '王': '玉', '⺩': '玉',
  // Foot variants
  '⻊': '足',
  // Bamboo variants
  '⺮': '竹', '⺲': '竹',
  // Net variants
  '罒': '网', '⺳': '网', '⺵': '网', '⻂': '网',
  // Clothing variants
  '衤': '衣', '⻂': '衣',
  // Ear variants
  '⻢': '馬',
  // Disease variants
  '疒': '疒',
  // Roof/Building variants
  '宀': '宀',
  // Additional common variants
  '⺀': '冫', // Ice
  '⺊': '卜', // Divination
  '⺌': '小', '⺍': '小', // Small
  '⺭': '示', '礻': '示', // Spirit
  '⻗': '雨', // Rain
  // Enclosure variants
  '囗': '囗',
  // Cliff variants
  '厂': '厂',
  // Wrap variants
  '勹': '勹',
  // Hiding variants
  '匚': '匚', '匸': '匸',
  // Dot variants
  '丶': '丶',
  // Stroke variants
  '丿': '丿', '乀': '丿', '乁': '丿',
  '丨': '丨', '亅': '亅',
  '乙': '乙', '乚': '乙', '⺄': '乙', '乛': '乙',
  // Self-mapping for standard radicals (ensure they map to themselves)
  '一': '一', '二': '二', '人': '人', '儿': '儿', '入': '入',
  '八': '八', '冂': '冂', '冖': '冖', '冫': '冫', '几': '几',
  '凵': '凵', '刀': '刀', '力': '力', '勹': '勹', '匕': '匕',
  '匚': '匚', '匸': '匸', '十': '十', '卜': '卜', '卩': '卩',
  '厂': '厂', '厶': '厶', '又': '又', '口': '口', '囗': '囗',
  '土': '土', '士': '士', '夂': '夂', '夊': '夊', '夕': '夕',
  '大': '大', '女': '女', '子': '子', '宀': '宀', '寸': '寸',
  '小': '小', '尢': '尢', '尸': '尸', '屮': '屮', '山': '山',
  '巛': '巛', '工': '工', '己': '己', '巾': '巾', '干': '干',
  '幺': '幺', '广': '广', '廴': '廴', '廾': '廾', '弋': '弋',
  '弓': '弓', '彐': '彐', '彡': '彡', '彳': '彳', '心': '心',
  '戈': '戈', '戶': '戶', '户': '戶', '手': '手', '支': '支',
  '攴': '攴', '攵': '攴', '文': '文', '斗': '斗', '斤': '斤',
  '方': '方', '无': '无', '旡': '无', '日': '日', '曰': '曰',
  '月': '月', '木': '木', '欠': '欠', '止': '止', '歹': '歹',
  '殳': '殳', '毋': '毋', '母': '毋', '比': '比', '毛': '毛',
  '氏': '氏', '气': '气', '水': '水', '火': '火', '爪': '爪',
  '父': '父', '爻': '爻', '爿': '爿', '片': '片', '牙': '牙',
  '牛': '牛', '犬': '犬', '玄': '玄', '玉': '玉', '瓜': '瓜',
  '瓦': '瓦', '甘': '甘', '生': '生', '用': '用', '田': '田',
  '疋': '疋', '疒': '疒', '癶': '癶', '白': '白', '皮': '皮',
  '皿': '皿', '目': '目', '矛': '矛', '矢': '矢', '石': '石',
  '示': '示', '禸': '禸', '禾': '禾', '穴': '穴', '立': '立',
  '竹': '竹', '米': '米', '糸': '糸', '缶': '缶', '网': '网',
  '羊': '羊', '羽': '羽', '老': '老', '而': '而', '耒': '耒',
  '耳': '耳', '聿': '聿', '肉': '肉', '臣': '臣', '自': '自',
  '至': '至', '臼': '臼', '舌': '舌', '舛': '舛', '舟': '舟',
  '艮': '艮', '色': '色', '艸': '艸', '虍': '虍', '虫': '虫',
  '血': '血', '行': '行', '衣': '衣', '襾': '襾', '西': '西',
  '見': '見', '见': '見', '角': '角', '言': '言', '谷': '谷',
  '豆': '豆', '豕': '豕', '豸': '豸', '貝': '貝', '贝': '貝',
  '赤': '赤', '走': '走', '足': '足', '身': '身', '車': '車',
  '车': '車', '辛': '辛', '辰': '辰', '辵': '辵', '邑': '邑',
  '酉': '酉', '釆': '釆', '里': '里', '金': '金', '長': '長',
  '长': '長', '門': '門', '门': '門', '阜': '阜', '隶': '隶',
  '隹': '隹', '雨': '雨', '青': '青', '非': '非', '面': '面',
  '革': '革', '韋': '韋', '韦': '韋', '韭': '韭', '音': '音',
  '頁': '頁', '页': '頁', '風': '風', '风': '風', '飛': '飛',
  '飞': '飛', '食': '食', '首': '首', '香': '香', '馬': '馬',
  '马': '馬', '骨': '骨', '高': '高', '髟': '髟', '鬥': '鬥',
  '鬯': '鬯', '鬲': '鬲', '鬼': '鬼', '魚': '魚', '鱼': '魚',
  '鳥': '鳥', '鸟': '鳥', '鹵': '鹵', '卤': '鹵', '鹿': '鹿',
  '麥': '麥', '麦': '麥', '麻': '麻', '黃': '黃', '黄': '黃',
  '黍': '黍', '黑': '黑', '黹': '黹', '黽': '黽', '黾': '黽',
  '鼎': '鼎', '鼓': '鼓', '鼠': '鼠', '鼻': '鼻', '齊': '齊',
  '齐': '齊', '齒': '齒', '齿': '齒', '龍': '龍', '龙': '龍',
  '龜': '龜', '龟': '龜', '龠': '龠',
  // Special cases
  '⺀': '冫',
  '⺁': '二',
  '⺃': '乙',
  '⺆': '冂',
  '⺇': '几',
  '⺋': '巛',
  '⺎': '夂',
  '⺏': '夕',
  '⺐': '女',
  '⺑': '己',
  '⺒': '己',
  '⺖': '忄',
  '⺙': '攵',
  '⺛': '斗',
  '⺜': '曰',
  '⺝': '月',
  '⺞': '殳',
  '⺟': '毋',
  '⺠': '气',
  '⺡': '氵',
  '⺣': '火',
  '⺤': '爪',
  '⺥': '爿',
  '⺦': '牛',
  '⺧': '犬',
  '⺪': '田',
  '⺫': '目',
  '⺬': '礻',
  '⺮': '竹',
  '⺰': '糹',
  '⺱': '网',
  '⺴': '羊',
  '⺶': '羊',
  '⺷': '老',
  '⺸': '耂',
  '⺹': '耳',
  '⺻': '肉',
  '⺼': '月',
  '⺽': '艸',
  '⻀': '艸',
  '⻁': '虍',
  '⻂': '衤',
  '⻄': '西',
  '⻅': '見',
  '⻆': '角',
  '⻇': '言',
  '⻉': '貝',
  '⻊': '足',
  '⻋': '車',
  '⻌': '辶',
  '⻍': '辶',
  '⻎': '辶',
  '⻏': '邑',
  '⻐': '金',
  '⻑': '長',
  '⻒': '門',
  '⻓': '长',
  '⻔': '门',
  '⻕': '阜',
  '⻖': '阜',
  '⻗': '雨',
  '⻘': '青',
  '⻙': '韋',
  '⻚': '頁',
  '⻛': '風',
  '⻜': '飛',
  '⻝': '食',
  '⻞': '食',
  '⻟': '食',
  '⻠': '馬',
  '⻡': '骨',
  '⻢': '馬',
  '⻣': '骨',
  '⻤': '鬼',
  '⻥': '魚',
  '⻦': '鳥',
  '⻧': '鹵',
  '⻨': '麥',
  '⻩': '黃',
  '⻪': '齊',
  '⻫': '齊',
  '⻬': '齊',
  '⻭': '齒',
  '⻮': '齒',
  '⻯': '龍',
  '⻰': '龍',
  '⻲': '龜',
  '⻳': '龜',
};

interface MakeHanziEntry {
  character: string;
  radical?: string;
  definition?: string;
  pinyin?: string[];
}

async function updateRadicalIndexes() {
  try {
    console.log("Starting radical index update from Make Me a Hanzi...");
    
    // Load Make Me a Hanzi dictionary
    const dictContent = fs.readFileSync("/tmp/makemeahanzi_dictionary.txt", "utf-8");
    const lines = dictContent.split("\n").filter(l => l.trim());
    
    // Build character -> radical map
    const charRadicalMap = new Map<string, string>();
    for (const line of lines) {
      try {
        const entry: MakeHanziEntry = JSON.parse(line);
        if (entry.character && entry.radical) {
          charRadicalMap.set(entry.character, entry.radical);
        }
      } catch {}
    }
    console.log(`Loaded ${charRadicalMap.size} character-radical mappings from Make Me a Hanzi`);
    
    // Load all radicals from database and create lookup map
    const allRadicals = await db.select().from(radicals);
    const radicalLookup = new Map<string, number>();
    for (const r of allRadicals) {
      radicalLookup.set(r.simplified, r.index);
      if (r.traditional && r.traditional !== r.simplified) {
        radicalLookup.set(r.traditional, r.index);
      }
    }
    console.log(`Loaded ${allRadicals.length} radicals from database`);
    
    // Function to normalize a radical to its Kangxi form and find index
    function findRadicalIndex(radical: string): number | null {
      // First try direct lookup
      if (radicalLookup.has(radical)) {
        return radicalLookup.get(radical)!;
      }
      
      // Try normalized form
      const normalized = radicalVariantMap[radical];
      if (normalized && radicalLookup.has(normalized)) {
        return radicalLookup.get(normalized)!;
      }
      
      // Try multiple normalization steps
      let current = radical;
      for (let i = 0; i < 3; i++) {
        if (radicalVariantMap[current]) {
          current = radicalVariantMap[current];
          if (radicalLookup.has(current)) {
            return radicalLookup.get(current)!;
          }
        } else {
          break;
        }
      }
      
      return null;
    }
    
    // Load all characters from database
    const allChars = await db.select().from(chineseCharacters);
    console.log(`Processing ${allChars.length} characters...`);
    
    let updated = 0;
    let alreadySet = 0;
    let notFound = 0;
    let noRadicalData = 0;
    const missingRadicals: string[] = [];
    
    for (const char of allChars) {
      // Skip if already has radical index
      if (char.radicalIndex !== null) {
        alreadySet++;
        continue;
      }
      
      // Find radical from Make Me a Hanzi
      let radical = charRadicalMap.get(char.simplified);
      if (!radical && char.traditional) {
        radical = charRadicalMap.get(char.traditional);
      }
      
      if (!radical) {
        noRadicalData++;
        continue;
      }
      
      // Find radical index
      const radicalIndex = findRadicalIndex(radical);
      
      if (radicalIndex !== null) {
        await db.update(chineseCharacters)
          .set({ radicalIndex })
          .where(eq(chineseCharacters.index, char.index));
        updated++;
      } else {
        notFound++;
        if (!missingRadicals.includes(radical)) {
          missingRadicals.push(radical);
        }
      }
    }
    
    console.log(`\n=== Results ===`);
    console.log(`Already had radical index: ${alreadySet}`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`No radical data in Make Me a Hanzi: ${noRadicalData}`);
    console.log(`Radical not found in database: ${notFound}`);
    if (missingRadicals.length > 0) {
      console.log(`Missing radicals: ${missingRadicals.join(', ')}`);
    }
    
    // Final count
    const finalCount = await db.select().from(chineseCharacters);
    const withRadical = finalCount.filter(c => c.radicalIndex !== null).length;
    console.log(`\nTotal characters with radical_index: ${withRadical} / ${finalCount.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

updateRadicalIndexes();
