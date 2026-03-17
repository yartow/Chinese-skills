import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, smallint, boolean, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Radicals table - Chinese character radicals
export const radicals = pgTable("radicals", {
  index: integer("index").primaryKey(),
  traditional: varchar("traditional").notNull(), // Traditional form of radical
  simplified: varchar("simplified").notNull(), // Simplified form of radical
  pinyin: varchar("pinyin").notNull(), // Pinyin with tone marks
  numberedPinyin: varchar("numbered_pinyin"), // Numbered pinyin (e.g., "pi3e4")
  alternativeFormIndex: integer("alternative_form_index"), // Reference to alternative form of this radical
  mainIndex: integer("main_index").notNull().default(1), // 1 if single form, 2+ if multiple forms
});

export type Radical = typeof radicals.$inferSelect;

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// User settings table
export const userSettings = pgTable("user_settings", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  currentLevel: integer("current_level").notNull().default(0),
  dailyCharCount: integer("daily_char_count").notNull().default(5),
  standardModePageSize: integer("standard_mode_page_size").notNull().default(20),
  preferTraditional: boolean("prefer_traditional").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  updatedAt: true,
});

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

// Character progress table - tracks star ratings for each character
export const characterProgress = pgTable("character_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  characterIndex: integer("character_index").notNull(),
  reading: boolean("reading").notNull().default(false),
  writing: boolean("writing").notNull().default(false),
  radical: boolean("radical").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_char").on(table.userId, table.characterIndex),
]);

export const insertCharacterProgressSchema = createInsertSchema(characterProgress).omit({
  id: true,
  updatedAt: true,
});

export type InsertCharacterProgress = z.infer<typeof insertCharacterProgressSchema>;
export type CharacterProgress = typeof characterProgress.$inferSelect;

// Chinese characters table - HSK 1-6 characters
export const chineseCharacters = pgTable("chinese_characters", {
  index: integer("index").primaryKey(),
  simplified: varchar("simplified").notNull(),
  traditional: varchar("traditional").notNull(),
  traditionalVariants: text("traditional_variants").array(), // Additional traditional character variants
  pinyin: varchar("pinyin").notNull(),
  pinyin2: varchar("pinyin2"), // Alternative pronunciation 2
  pinyin3: varchar("pinyin3"), // Alternative pronunciation 3
  numberedPinyin: varchar("numbered_pinyin"), // Numbered pinyin for primary (e.g., "xue2")
  numberedPinyin2: varchar("numbered_pinyin2"), // Numbered pinyin for alt 2
  numberedPinyin3: varchar("numbered_pinyin3"), // Numbered pinyin for alt 3
  radicalIndex: integer("radical_index").references(() => radicals.index, { onDelete: "set null" }), // Foreign key to radicals table
  definition: text("definition").array().notNull(),
  examples: jsonb("examples").notNull(), // Array of { chinese: string, english: string }
  hskLevel: integer("hsk_level").notNull().default(1), // HSK level 1-6
  lesson: smallint("lesson"), // Lesson number for curriculum organization (nullable)
});

export type ChineseCharacter = typeof chineseCharacters.$inferSelect & {
  radicalPinyin?: string;
  radical?: string;
};

// Chinese words/vocabulary table - Multi-character words from HSK
export const chineseWords = pgTable("chinese_words", {
  id: integer("id").primaryKey(),
  word: varchar("word").notNull(), // e.g., "学校"
  pinyin: varchar("pinyin").notNull(), // e.g., "xué xiào"
  definition: text("definition").array().notNull(),
  hskLevel: integer("hsk_level").notNull().default(1), // HSK level 1-6
  examples: jsonb("examples").notNull(), // Array of { chinese: string, english: string }
});

export type ChineseWord = typeof chineseWords.$inferSelect;

// Word progress table - tracks user's knowledge of vocabulary words
export const wordProgress = pgTable("word_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  wordId: integer("word_id").notNull().references(() => chineseWords.id, { onDelete: "cascade" }),
  known: boolean("known").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_word").on(table.userId, table.wordId),
]);

export const insertWordProgressSchema = createInsertSchema(wordProgress).omit({
  id: true,
  updatedAt: true,
});

export type InsertWordProgress = z.infer<typeof insertWordProgressSchema>;
export type WordProgress = typeof wordProgress.$inferSelect;
