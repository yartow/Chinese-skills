import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

// Chinese characters table - the 2500 most common characters
export const chineseCharacters = pgTable("chinese_characters", {
  index: integer("index").primaryKey(),
  simplified: varchar("simplified").notNull(),
  traditional: varchar("traditional").notNull(),
  pinyin: varchar("pinyin").notNull(),
  radical: varchar("radical").notNull(),
  radicalPinyin: varchar("radical_pinyin").notNull(),
  definition: text("definition").array().notNull(),
  examples: jsonb("examples").notNull(), // Array of { chinese: string, english: string }
});

export type ChineseCharacter = typeof chineseCharacters.$inferSelect;
