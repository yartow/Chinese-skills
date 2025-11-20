import { db } from "./db";
import { chineseCharacters } from "@shared/schema";
import { eq } from "drizzle-orm";

// Better example sentences for the most common characters
const betterExamples: Record<number, Array<{chinese: string, english: string}>> = {
  0: [ // 的
    {chinese: "我的书", english: "my book"},
    {chinese: "他的朋友", english: "his friend"},
    {chinese: "你的家", english: "your home"}
  ],
  2: [ // 在
    {chinese: "我在家", english: "I'm at home"},
    {chinese: "书在桌子上", english: "The book is on the table"},
    {chinese: "你在哪里？", english: "Where are you?"}
  ],
  3: [ // 是
    {chinese: "我是学生", english: "I am a student"},
    {chinese: "这是我的", english: "This is mine"},
    {chinese: "他是老师", english: "He is a teacher"}
  ],
  4: [ // 我
    {chinese: "我爱你", english: "I love you"},
    {chinese: "我是中国人", english: "I am Chinese"},
    {chinese: "我叫王明", english: "My name is Wang Ming"}
  ],
  5: [ // 一
    {chinese: "一个人", english: "one person"},
    {chinese: "一本书", english: "one book"},
    {chinese: "第一", english: "first"}
  ],
  6: [ // 有
    {chinese: "我有一个问题", english: "I have a question"},
    {chinese: "没有时间", english: "no time"},
    {chinese: "有意思", english: "interesting"}
  ],
  7: [ // 这
    {chinese: "这是什么？", english: "What is this?"},
    {chinese: "这个很好", english: "This is very good"},
    {chinese: "这里", english: "here"}
  ],
  8: [ // 人
    {chinese: "好人", english: "good person"},
    {chinese: "中国人", english: "Chinese person"},
    {chinese: "人们", english: "people"}
  ],
  9: [ // 不
    {chinese: "不好", english: "not good"},
    {chinese: "不是", english: "is not"},
    {chinese: "不要", english: "don't want"}
  ],
  10: [ // 了
    {chinese: "吃了饭", english: "ate food"},
    {chinese: "好了", english: "okay / done"},
    {chinese: "走了", english: "left"}
  ],
  11: [ // 他
    {chinese: "他是我朋友", english: "He is my friend"},
    {chinese: "他们", english: "they"},
    {chinese: "他的", english: "his"}
  ],
  12: [ // 中
    {chinese: "中国", english: "China"},
    {chinese: "中文", english: "Chinese language"},
    {chinese: "中间", english: "middle"}
  ],
  13: [ // 就
    {chinese: "就这样", english: "that's it"},
    {chinese: "我就来", english: "I'm coming"},
    {chinese: "就是", english: "exactly"}
  ],
  14: [ // 为
    {chinese: "为什么", english: "why"},
    {chinese: "因为", english: "because"},
    {chinese: "为了你", english: "for you"}
  ],
  15: [ // 也
    {chinese: "我也是", english: "Me too"},
    {chinese: "也可以", english: "also okay"},
    {chinese: "也没有", english: "also don't have"}
  ],
  146: [ // 学
    {chinese: "我在学中文", english: "I'm learning Chinese"},
    {chinese: "学校", english: "school"},
    {chinese: "学生", english: "student"}
  ]
};

async function updateExamples() {
  console.log("Updating example sentences...");
  
  for (const [index, examples] of Object.entries(betterExamples)) {
    await db.update(chineseCharacters)
      .set({ examples: JSON.stringify(examples) })
      .where(eq(chineseCharacters.index, parseInt(index)));
    
    console.log(`Updated character at index ${index}`);
  }
  
  console.log("Done!");
  process.exit(0);
}

updateExamples();
