import { sql, isNull, isNotNull } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, smallint, boolean, index, uniqueIndex, unique, jsonb, serial, check } from "drizzle-orm/pg-core";
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

// Session storage table (required for express-session + connect-pg-simple)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 20 }).notNull().default("user"), // 'user' | 'teacher' | 'student'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// App-level configuration — single row (id = 1), not per-user
export const appConfig = pgTable("app_config", {
  id: integer("id").primaryKey().default(1),
  // When true, autoSeed detects seed-file changes (via checksum) and runs a full
  // upsert to propagate updated characters/examples to the live database.
  // Set to false if you have uploaded custom data you don't want overwritten.
  autoReloadDatabase: boolean("auto_reload_database").notNull().default(true),
  // MD5 checksum of the last seed files that were successfully applied.
  seedChecksum: varchar("seed_checksum"),
});
export type AppConfig = typeof appConfig.$inferSelect;

// User settings table
export const userSettings = pgTable("user_settings", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  currentLevel: integer("current_level").notNull().default(0),
  dailyCharCount: integer("daily_char_count").notNull().default(5),
  standardModePageSize: integer("standard_mode_page_size").notNull().default(20),
  preferTraditional: boolean("prefer_traditional").notNull().default(true),
  useAiFeedback: boolean("use_ai_feedback").notNull().default(false),
  useAiSentences: boolean("use_ai_sentences").notNull().default(false),
  anthropicApiKey: varchar("anthropic_api_key"), // User-supplied Anthropic API key (nullable)
  handwritingCandidates: integer("handwriting_candidates").notNull().default(8),
  advancedEditMode: boolean("advanced_edit_mode").notNull().default(false),
  maxPointsPerChar: integer("max_points_per_char").notNull().default(10),
  aiGenerationMode: boolean("ai_generation_mode").notNull().default(false),
  hskColorMode: boolean("hsk_color_mode").notNull().default(false),
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
  radicalIndex: integer("radical_index").references(() => radicals.index, { onDelete: "set null" }), // Foreign key to radicals table (simplified)
  radicalIndexTraditional: integer("radical_index_traditional").references(() => radicals.index, { onDelete: "set null" }), // Foreign key for traditional radical (nullable until populated)
  definition: text("definition").array().notNull(),
  examples: jsonb("examples").notNull(), // Array of { chinese: string, english: string }
  examplesTraditional: jsonb("examples_traditional"), // Traditional form of examples (nullable until translated)
  hskLevel: integer("hsk_level").notNull().default(1), // HSK level 1-6
  lesson: smallint("lesson"), // Lesson number for curriculum organization (nullable)
  wordExamples: jsonb("word_examples"), // Array of word usage examples (nullable)
  wordExamplesTraditional: jsonb("word_examples_traditional"), // Traditional form of wordExamples (nullable until translated)
  // When one simplified form maps to multiple traditional characters (e.g. 发→發/髮),
  // this stores each traditional reading with its own pinyin and definition.
  // null = unambiguous 1-to-1 mapping.
  traditionalMappings: jsonb("traditional_mappings").$type<Array<{
    char: string;
    pinyin: string;
    numberedPinyin: string;
    definition: string[];
  }>>(),
});

export type ChineseCharacter = typeof chineseCharacters.$inferSelect & {
  radicalPinyin?: string | null;
  radical?: string | null;
  radicalTraditional?: string | null;
  radicalPinyinTraditional?: string | null;
};

// Chinese words/vocabulary table - Multi-character words from HSK
export const chineseWords = pgTable("chinese_words", {
  id: integer("id").primaryKey(),
  word: varchar("word").notNull(), // simplified, e.g., "学校"
  traditional: varchar("traditional").notNull().default(""), // traditional, e.g., "學校"
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
  unique("unique_user_word").on(table.userId, table.wordId),
]);

export const insertWordProgressSchema = createInsertSchema(wordProgress).omit({
  id: true,
  updatedAt: true,
});

export type InsertWordProgress = z.infer<typeof insertWordProgressSchema>;
export type WordProgress = typeof wordProgress.$inferSelect;

// Saved items table - words and sentences bookmarked by the user
export const savedItems = pgTable("saved_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 10 }).notNull(), // 'word' | 'sentence'
  chinese: text("chinese").notNull(),
  pinyin: varchar("pinyin").notNull().default(""),
  english: text("english").notNull(),
  savedAt: timestamp("saved_at").defaultNow(),
}, (table) => [
  index("idx_user_saved").on(table.userId),
  unique("uq_user_saved_chinese").on(table.userId, table.chinese),
]);

export type SavedItem = typeof savedItems.$inferSelect;

// AI-generated quiz sentences — one sentence per character, generated on demand
export const generatedSentences = pgTable("generated_sentences", {
  id: serial("id").primaryKey(),
  characterIndex: integer("character_index").notNull().references(() => chineseCharacters.index),
  sentence: text("sentence").notNull(),
  blanked: text("blanked").notNull(),
  translation: text("translation").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_generated_sentences_character").on(table.characterIndex),
]);

// Teacher–student relationships
export const teacherStudents = pgTable("teacher_students", {
  id: serial("id").primaryKey(),
  teacherId: varchar("teacher_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  studentId: varchar("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending' | 'approved'
}, (table) => [
  unique("uq_teacher_student").on(table.teacherId, table.studentId),
]);

export type TeacherStudent = typeof teacherStudents.$inferSelect;

// Activity logs — tracks time spent per view per day (seconds of active tab time)
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD in user's local timezone
  view: varchar("view", { length: 20 }).notNull(), // 'standard' | 'test'
  seconds: integer("seconds").notNull().default(0),
}, (table) => [
  unique("uq_activity_user_date_view").on(table.userId, table.date, table.view),
]);

export type ActivityLog = typeof activityLogs.$inferSelect;

export const progressHistory = pgTable("progress_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  characterIndex: integer("character_index").notNull(),
  skillType: varchar("skill_type", { length: 10 }).notNull(), // 'reading' | 'writing' | 'radical'
  gained: boolean("gained").notNull(), // true = mastered, false = lost mastery
  changedAt: timestamp("changed_at").defaultNow().notNull(),
}, (t) => [
  index("idx_progress_history_user_time").on(t.userId, t.changedAt),
]);

export type ProgressHistory = typeof progressHistory.$inferSelect;

// Check-ups — writing assessments created by teachers for students
export const checkups = pgTable("checkups", {
  id: serial("id").primaryKey(),
  teacherId: varchar("teacher_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  studentId: varchar("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | submitted | scored
  displayMode: varchar("display_mode", { length: 10 }).notNull().default("pinyin"), // pinyin | zhuyin
  gridType: varchar("grid_type", { length: 20 }).notNull().default("field"), // field (田字格) | cross (十字格) | blank
  maxPointsPerChar: integer("max_points_per_char").notNull().default(10),
  createdAt: timestamp("created_at").defaultNow(),
  submittedAt: timestamp("submitted_at"),
  scoredAt: timestamp("scored_at"),
});

export type Checkup = typeof checkups.$inferSelect;

export const checkupItems = pgTable("checkup_items", {
  id: serial("id").primaryKey(),
  checkupId: integer("checkup_id").notNull().references(() => checkups.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  character: varchar("character", { length: 4 }).notNull(),
  pinyin: varchar("pinyin"),
  numberedPinyin: varchar("numbered_pinyin"),
  drawing: text("drawing"),       // base64 PNG, filled on student submit
  pointsAwarded: integer("points_awarded"), // filled on teacher score
  feedback: text("feedback"),
}, (table) => [
  index("idx_checkup_items_checkup").on(table.checkupId, table.position),
]);

export type CheckupItem = typeof checkupItems.$inferSelect;

// Messages between teachers and their students
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientId: varchar("recipient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  readAt: timestamp("read_at"), // null = unread
}, (table) => [
  index("idx_messages_recipient").on(table.recipientId, table.sentAt),
  index("idx_messages_sender").on(table.senderId, table.sentAt),
]);

export type Message = typeof messages.$inferSelect;

// Character bug reports — submitted by any user from the character detail page
export const characterReports = pgTable("character_reports", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  characterIndex: integer("character_index").notNull().references(() => chineseCharacters.index, { onDelete: "cascade" }),
  explanation: text("explanation").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_character_reports_character").on(table.characterIndex),
  index("idx_character_reports_user").on(table.userId),
  check("chk_report_status", sql`"status" IN ('open', 'resolved')`),
]);

export type CharacterReport = typeof characterReports.$inferSelect;

// Quiz feedback cache — stores AI-generated feedback per (blanked, character) pair
// so the same explanation can be reused without calling the AI again.
export const quizFeedbackCache = pgTable("quiz_feedback_cache", {
  id: serial("id").primaryKey(),
  blanked: text("blanked").notNull(),
  character: varchar("character", { length: 4 }).notNull(),
  feedback: text("feedback").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_feedback_blanked_char").on(table.blanked, table.character),
]);

// ─── Customize feature ────────────────────────────────────────────────────────

// Sources — e.g. "Oxford Publishing", "My own notes"
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("idx_sources_user").on(t.userId)]);

export type Source = typeof sources.$inferSelect;

// Classes — e.g. "Class 101", "Chinese for Advanced Students"
export const customClasses = pgTable("classes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sourceId: integer("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("idx_classes_user").on(t.userId)]);

export type CustomClass = typeof customClasses.$inferSelect;

// Lessons — e.g. "Lesson 1", "1". One class has many lessons.
export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lesson: text("lesson").notNull(),
  classId: integer("class_id").notNull().references(() => customClasses.id, { onDelete: "cascade" }),
  sourceId: integer("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_lessons_user").on(t.userId),
  uniqueIndex("uq_class_lesson").on(t.classId, t.lesson),
]);

export type Lesson = typeof lessons.$inferSelect;

// Custom_Matching — maps characters to lessons.
// teacherStudentId is NULL for personal (solo / teacher-without-students) matches;
// set to the relationship id for shared matches. userId always records the creator.
export const customMatching = pgTable("custom_matching", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teacherStudentId: integer("teacher_student_id")
    .references(() => teacherStudents.id, { onDelete: "cascade" }),
  characterIndex: integer("character_index").notNull()
    .references(() => chineseCharacters.index, { onDelete: "cascade" }),
  lessonId: integer("lesson_id").notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  core: boolean("core").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_custom_matching_rel").on(t.teacherStudentId),
  index("idx_custom_matching_user").on(t.userId),
  uniqueIndex("uq_personal_char_lesson")
    .on(t.userId, t.characterIndex, t.lessonId)
    .where(isNull(t.teacherStudentId)),
  uniqueIndex("uq_shared_char_lesson")
    .on(t.teacherStudentId, t.characterIndex, t.lessonId)
    .where(isNotNull(t.teacherStudentId)),
]);

export type CustomMatching = typeof customMatching.$inferSelect;

// ─── Character tags ───────────────────────────────────────────────────────────

export const characterTags = pgTable("character_tags", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_tags_user").on(t.userId),
  unique("uq_user_tag_name").on(t.userId, t.name),
]);

export type CharacterTag = typeof characterTags.$inferSelect;

export const characterTagAssignments = pgTable("character_tag_assignments", {
  id: serial("id").primaryKey(),
  tagId: integer("tag_id").notNull().references(() => characterTags.id, { onDelete: "cascade" }),
  characterIndex: integer("character_index").notNull().references(() => chineseCharacters.index, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [
  uniqueIndex("uq_tag_char_assignment").on(t.tagId, t.characterIndex),
  index("idx_tag_assignments_tag").on(t.tagId),
  index("idx_tag_assignments_user").on(t.userId),
]);

export type CharacterTagAssignment = typeof characterTagAssignments.$inferSelect;
