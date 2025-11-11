import { db } from "./db";
import { chineseCharacters } from "@shared/schema";

// Sample of the 2500 most common Chinese characters with complete data
// This is a subset for demonstration - in production would include all 2500
const characterData = [
  {
    index: 0,
    simplified: "的",
    traditional: "的",
    pinyin: "de",
    radical: "白",
    radicalPinyin: "bái",
    definition: ["of", "possessive particle", "~'s (possessive)"],
    examples: [
      { chinese: "我的书", english: "my book" },
      { chinese: "他的朋友", english: "his friend" },
      { chinese: "中国的文化", english: "China's culture" },
      { chinese: "好的", english: "good / OK" },
      { chinese: "漂亮的女孩", english: "beautiful girl" },
    ],
  },
  {
    index: 1,
    simplified: "一",
    traditional: "一",
    pinyin: "yī",
    radical: "一",
    radicalPinyin: "yī",
    definition: ["one", "single", "a (article)"],
    examples: [
      { chinese: "一个人", english: "one person / alone" },
      { chinese: "一本书", english: "a book" },
      { chinese: "一起", english: "together" },
      { chinese: "一定", english: "certainly / must" },
      { chinese: "一天", english: "one day" },
    ],
  },
  {
    index: 2,
    simplified: "是",
    traditional: "是",
    pinyin: "shì",
    radical: "日",
    radicalPinyin: "rì",
    definition: ["to be", "yes", "is / am / are"],
    examples: [
      { chinese: "我是学生", english: "I am a student" },
      { chinese: "这是什么?", english: "What is this?" },
      { chinese: "是的", english: "yes" },
      { chinese: "不是", english: "is not / no" },
      { chinese: "你是谁?", english: "Who are you?" },
    ],
  },
  {
    index: 3,
    simplified: "不",
    traditional: "不",
    pinyin: "bù",
    radical: "一",
    radicalPinyin: "yī",
    definition: ["not", "no"],
    examples: [
      { chinese: "不好", english: "not good" },
      { chinese: "不是", english: "is not" },
      { chinese: "不要", english: "don't want" },
      { chinese: "不知道", english: "don't know" },
      { chinese: "不行", english: "won't do / not acceptable" },
    ],
  },
  {
    index: 4,
    simplified: "了",
    traditional: "了",
    pinyin: "le",
    radical: "亅",
    radicalPinyin: "jué",
    definition: ["particle marking completed action", "extremely"],
    examples: [
      { chinese: "我吃了", english: "I ate" },
      { chinese: "好了", english: "done / finished" },
      { chinese: "太好了!", english: "That's great!" },
      { chinese: "走了", english: "left / gone" },
      { chinese: "下雨了", english: "It's raining" },
    ],
  },
  {
    index: 5,
    simplified: "在",
    traditional: "在",
    pinyin: "zài",
    radical: "土",
    radicalPinyin: "tǔ",
    definition: ["at", "in", "on", "to be located"],
    examples: [
      { chinese: "我在家", english: "I'm at home" },
      { chinese: "在中国", english: "in China" },
      { chinese: "在哪里?", english: "Where?" },
      { chinese: "现在", english: "now" },
      { chinese: "存在", english: "to exist" },
    ],
  },
  {
    index: 6,
    simplified: "人",
    traditional: "人",
    pinyin: "rén",
    radical: "人",
    radicalPinyin: "rén",
    definition: ["person", "people", "human"],
    examples: [
      { chinese: "一个人", english: "one person" },
      { chinese: "中国人", english: "Chinese person" },
      { chinese: "人们", english: "people" },
      { chinese: "别人", english: "other people" },
      { chinese: "好人", english: "good person" },
    ],
  },
  {
    index: 7,
    simplified: "有",
    traditional: "有",
    pinyin: "yǒu",
    radical: "月",
    radicalPinyin: "yuè",
    definition: ["to have", "there is/are", "to exist"],
    examples: [
      { chinese: "我有一本书", english: "I have a book" },
      { chinese: "有问题", english: "have a question" },
      { chinese: "有时候", english: "sometimes" },
      { chinese: "没有", english: "don't have / there isn't" },
      { chinese: "有意思", english: "interesting" },
    ],
  },
  {
    index: 8,
    simplified: "我",
    traditional: "我",
    pinyin: "wǒ",
    radical: "戈",
    radicalPinyin: "gē",
    definition: ["I", "me", "my"],
    examples: [
      { chinese: "我是学生", english: "I am a student" },
      { chinese: "我的", english: "my / mine" },
      { chinese: "我们", english: "we / us" },
      { chinese: "我爱你", english: "I love you" },
      { chinese: "我想", english: "I think / I want" },
    ],
  },
  {
    index: 9,
    simplified: "他",
    traditional: "他",
    pinyin: "tā",
    radical: "人",
    radicalPinyin: "rén",
    definition: ["he", "him"],
    examples: [
      { chinese: "他是谁?", english: "Who is he?" },
      { chinese: "他的书", english: "his book" },
      { chinese: "他们", english: "they / them" },
      { chinese: "其他", english: "other" },
      { chinese: "他说", english: "he said" },
    ],
  },
];

// Generate more characters to reach 2500 (this is simplified - would need full dataset)
function generateCharacterData(): typeof characterData {
  const fullData = [...characterData];
  
  // Add more common characters
  const moreCharacters = [
    {
      index: 10,
      simplified: "这",
      traditional: "這",
      pinyin: "zhè",
      radical: "辶",
      radicalPinyin: "chuò",
      definition: ["this", "these"],
      examples: [
        { chinese: "这个", english: "this one" },
        { chinese: "这是什么?", english: "What is this?" },
        { chinese: "这里", english: "here" },
        { chinese: "这样", english: "like this / in this way" },
        { chinese: "这些", english: "these" },
      ],
    },
    {
      index: 11,
      simplified: "中",
      traditional: "中",
      pinyin: "zhōng",
      radical: "丨",
      radicalPinyin: "gǔn",
      definition: ["middle", "center", "China", "Chinese"],
      examples: [
        { chinese: "中国", english: "China" },
        { chinese: "中文", english: "Chinese language" },
        { chinese: "中间", english: "middle" },
        { chinese: "中学", english: "middle school" },
        { chinese: "其中", english: "among / in" },
      ],
    },
    {
      index: 12,
      simplified: "大",
      traditional: "大",
      pinyin: "dà",
      radical: "大",
      radicalPinyin: "dà",
      definition: ["big", "large", "great"],
      examples: [
        { chinese: "大学", english: "university" },
        { chinese: "大家", english: "everyone" },
        { chinese: "很大", english: "very big" },
        { chinese: "大小", english: "size" },
        { chinese: "大多", english: "mostly / most" },
      ],
    },
    {
      index: 13,
      simplified: "来",
      traditional: "來",
      pinyin: "lái",
      radical: "木",
      radicalPinyin: "mù",
      definition: ["to come", "to arrive", "next"],
      examples: [
        { chinese: "来了", english: "come / arrived" },
        { chinese: "过来", english: "come over" },
        { chinese: "回来", english: "come back" },
        { chinese: "未来", english: "future" },
        { chinese: "原来", english: "originally / it turns out" },
      ],
    },
    {
      index: 14,
      simplified: "上",
      traditional: "上",
      pinyin: "shàng",
      radical: "一",
      radicalPinyin: "yī",
      definition: ["up", "on", "above", "to go up"],
      examples: [
        { chinese: "上面", english: "above / on top" },
        { chinese: "上学", english: "go to school" },
        { chinese: "上班", english: "go to work" },
        { chinese: "早上", english: "morning" },
        { chinese: "加上", english: "plus / in addition" },
      ],
    },
    {
      index: 15,
      simplified: "国",
      traditional: "國",
      pinyin: "guó",
      radical: "囗",
      radicalPinyin: "wéi",
      definition: ["country", "nation", "national"],
      examples: [
        { chinese: "中国", english: "China" },
        { chinese: "国家", english: "country / nation" },
        { chinese: "美国", english: "United States" },
        { chinese: "外国", english: "foreign country" },
        { chinese: "国际", english: "international" },
      ],
    },
    {
      index: 16,
      simplified: "个",
      traditional: "個",
      pinyin: "gè",
      radical: "人",
      radicalPinyin: "rén",
      definition: ["(measure word)", "individual"],
      examples: [
        { chinese: "一个人", english: "one person" },
        { chinese: "这个", english: "this one" },
        { chinese: "那个", english: "that one" },
        { chinese: "个人", english: "individual / personal" },
        { chinese: "几个", english: "how many / several" },
      ],
    },
    {
      index: 17,
      simplified: "到",
      traditional: "到",
      pinyin: "dào",
      radical: "刀",
      radicalPinyin: "dāo",
      definition: ["to arrive", "to reach", "until"],
      examples: [
        { chinese: "到了", english: "arrived" },
        { chinese: "看到", english: "see / catch sight of" },
        { chinese: "得到", english: "to get / obtain" },
        { chinese: "想到", english: "think of" },
        { chinese: "一直到", english: "until" },
      ],
    },
    {
      index: 18,
      simplified: "说",
      traditional: "說",
      pinyin: "shuō",
      radical: "言",
      radicalPinyin: "yán",
      definition: ["to say", "to speak", "to talk"],
      examples: [
        { chinese: "他说", english: "he said" },
        { chinese: "说话", english: "to speak" },
        { chinese: "小说", english: "novel" },
        { chinese: "听说", english: "heard that / it is said" },
        { chinese: "说明", english: "to explain / explanation" },
      ],
    },
    {
      index: 19,
      simplified: "们",
      traditional: "們",
      pinyin: "men",
      radical: "人",
      radicalPinyin: "rén",
      definition: ["(plural marker)"],
      examples: [
        { chinese: "我们", english: "we / us" },
        { chinese: "他们", english: "they / them" },
        { chinese: "人们", english: "people" },
        { chinese: "你们", english: "you (plural)" },
        { chinese: "朋友们", english: "friends" },
      ],
    },
  ];

  fullData.push(...moreCharacters);

  // For the remaining characters, we'll create placeholders
  // In a real app, this would be a complete dataset
  for (let i = fullData.length; i < 2500; i++) {
    fullData.push({
      index: i,
      simplified: `字${i}`,
      traditional: `字${i}`,
      pinyin: `zì${i}`,
      radical: "字",
      radicalPinyin: "zì",
      definition: [`Character ${i}`, "placeholder"],
      examples: [
        { chinese: `例句${i}`, english: `Example sentence ${i}` },
        { chinese: `这是字${i}`, english: `This is character ${i}` },
        { chinese: `学习字${i}`, english: `Study character ${i}` },
      ],
    });
  }

  return fullData;
}

export async function seedCharacters() {
  try {
    const allCharacters = generateCharacterData();
    console.log(`Seeding ${allCharacters.length} characters...`);

    // Insert in batches for better performance
    const batchSize = 100;
    for (let i = 0; i < allCharacters.length; i += batchSize) {
      const batch = allCharacters.slice(i, i + batchSize);
      await db.insert(chineseCharacters).values(batch).onConflictDoNothing();
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allCharacters.length / batchSize)}`);
    }

    console.log("Character seeding complete!");
  } catch (error) {
    console.error("Error seeding characters:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCharacters()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
