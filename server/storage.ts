// Replit Auth storage implementation - blueprint:javascript_log_in_with_replit
import {
  users,
  userSettings,
  characterProgress,
  chineseCharacters,
  chineseWords,
  wordProgress,
  radicals,
  savedItems,
  generatedSentences,
  quizFeedbackCache,
  type User,
  type UpsertUser,
  type UserSettings,
  type InsertUserSettings,
  type CharacterProgress,
  type InsertCharacterProgress,
  type ChineseCharacter,
  type ChineseWord,
  type WordProgress,
  type SavedItem,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, lt, inArray, notInArray, or, isNull, like, sql, count } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// Aliased radical joins — rs = simplified radical, rt = traditional radical
const radicalsSimp = alias(radicals, "rs");
const radicalsTrad = alias(radicals, "rt");

export interface CharacterFilters {
  hskLevels?: number[];
  filterReading?: boolean;
  filterWriting?: boolean;
  filterRadical?: boolean;
}

export interface FilteredCharactersResult {
  characters: ChineseCharacter[];
  total: number;
}

export interface MasteryStats {
  readingMastered: number;
  writingMastered: number;
  radicalMastered: number;
  characterMastered: number; // True only when all three above are true
  total: number;
}

export interface CharacterUpdate {
  index: number;
  lesson?: number | null;
  hskLevel?: number;
  simplified?: string;
  traditional?: string;
  traditionalVariants?: string[] | null;
  radicalIndex?: number | null;
  definition?: string[];
  radicalIndexTraditional?: number | null;
  examples?: unknown;
  examplesTraditional?: unknown;
  wordExamples?: unknown;
  wordExamplesTraditional?: unknown;
  pinyin?: string;
  pinyin2?: string | null;
  pinyin3?: string | null;
  numberedPinyin?: string | null;
  numberedPinyin2?: string | null;
  numberedPinyin3?: string | null;
}

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // User settings operations
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  upsertUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  
  // Character progress operations
  getCharacterProgress(userId: string, characterIndex: number): Promise<CharacterProgress | undefined>;
  getUserCharacterProgress(userId: string, startIndex: number, count: number): Promise<CharacterProgress[]>;
  upsertCharacterProgress(progress: InsertCharacterProgress): Promise<CharacterProgress>;
  getMasteryStats(userId: string): Promise<MasteryStats>;
  getFirstNonMasteredIndex(userId: string, startIndex: number): Promise<number>;

  // Saved items operations
  getSavedItems(userId: string): Promise<SavedItem[]>;
  toggleSavedItem(userId: string, item: { type: string; chinese: string; pinyin: string; english: string }): Promise<{ saved: boolean }>;

  // Chinese characters operations
  getCharacter(index: number): Promise<ChineseCharacter | undefined>;
  getCharacters(startIndex: number, count: number): Promise<ChineseCharacter[]>;
  getAllCharacters(): Promise<ChineseCharacter[]>;
  getAllCharactersRaw(): Promise<typeof chineseCharacters.$inferSelect[]>;
  getCharactersByLesson(lesson: number): Promise<ChineseCharacter[]>;
  getCharactersByLessonRange(lessonStart: number, lessonEnd: number): Promise<ChineseCharacter[]>;
  getBrowseCharacters(): Promise<{ index: number; simplified: string; traditional: string; pinyin: string; hskLevel: number; lesson: number | null }[]>;
  getFilteredCharacters(userId: string, page: number, pageSize: number, filters: CharacterFilters): Promise<FilteredCharactersResult>;
  getRandomCharactersForQuiz(hskLevels: number[], count: number, excludeIndices?: number[]): Promise<ChineseCharacter[]>;
  updateCharactersBatch(updates: CharacterUpdate[]): Promise<number>;

  // Generated sentences cache operations
  getGeneratedSentences(characterIndex: number): Promise<{ sentence: string; blanked: string; translation: string }[]>;
  saveGeneratedSentence(characterIndex: number, sentence: string, blanked: string, translation: string): Promise<void>;

  // Quiz feedback cache operations
  getFeedbackCache(blanked: string, character: string): Promise<string | null>;
  setFeedbackCache(blanked: string, character: string, feedback: string): Promise<void>;

  // Word browse operations
  getFilteredWords(userId: string, page: number, pageSize: number, hskLevels?: number[], filterUnknown?: boolean): Promise<{ words: ChineseWord[]; total: number }>;
  getWordBatchProgress(userId: string, wordIds: number[]): Promise<WordProgress[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // User settings operations
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings;
  }

  async upsertUserSettings(settingsData: InsertUserSettings): Promise<UserSettings> {
    const [settings] = await db
      .insert(userSettings)
      .values(settingsData)
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          ...settingsData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return settings;
  }

  // Character progress operations
  async getCharacterProgress(userId: string, characterIndex: number): Promise<CharacterProgress | undefined> {
    const [progress] = await db
      .select()
      .from(characterProgress)
      .where(and(eq(characterProgress.userId, userId), eq(characterProgress.characterIndex, characterIndex)));
    return progress;
  }

  async getUserCharacterProgress(userId: string, startIndex: number, count: number): Promise<CharacterProgress[]> {
    const progress = await db
      .select()
      .from(characterProgress)
      .where(
        and(
          eq(characterProgress.userId, userId),
          gte(characterProgress.characterIndex, startIndex),
          lt(characterProgress.characterIndex, startIndex + count)
        )
      )
      .orderBy(characterProgress.characterIndex);
    
    return progress;
  }

  async getBatchCharacterProgress(userId: string, indices: number[]): Promise<CharacterProgress[]> {
    if (indices.length === 0) {
      return [];
    }

    const progress = await db
      .select()
      .from(characterProgress)
      .where(
        and(
          eq(characterProgress.userId, userId),
          inArray(characterProgress.characterIndex, indices)
        )
      )
      .orderBy(characterProgress.characterIndex);
    
    return progress;
  }

  async upsertCharacterProgress(progressData: InsertCharacterProgress): Promise<CharacterProgress> {
    // First try to find existing progress
    const existing = await this.getCharacterProgress(progressData.userId, progressData.characterIndex);
    
    if (existing) {
      const [updated] = await db
        .update(characterProgress)
        .set({
          reading: progressData.reading,
          writing: progressData.writing,
          radical: progressData.radical,
          updatedAt: new Date(),
        })
        .where(eq(characterProgress.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(characterProgress)
        .values(progressData)
        .returning();
      return created;
    }
  }

  async getMasteryStats(userId: string): Promise<MasteryStats> {
    const result = await db
      .select({
        readingMastered: sql<number>`COUNT(*) FILTER (WHERE ${characterProgress.reading} = true)`,
        writingMastered: sql<number>`COUNT(*) FILTER (WHERE ${characterProgress.writing} = true)`,
        radicalMastered: sql<number>`COUNT(*) FILTER (WHERE ${characterProgress.radical} = true)`,
        characterMastered: sql<number>`COUNT(*) FILTER (WHERE ${characterProgress.reading} = true AND ${characterProgress.writing} = true AND ${characterProgress.radical} = true)`,
      })
      .from(characterProgress)
      .where(eq(characterProgress.userId, userId));

    return {
      readingMastered: Number(result[0]?.readingMastered || 0),
      writingMastered: Number(result[0]?.writingMastered || 0),
      radicalMastered: Number(result[0]?.radicalMastered || 0),
      characterMastered: Number(result[0]?.characterMastered || 0),
      total: 3000,
    };
  }

  async getFirstNonMasteredIndex(userId: string, startIndex: number): Promise<number> {
    const masteredIndices = await db
      .select({ characterIndex: characterProgress.characterIndex })
      .from(characterProgress)
      .where(
        and(
          eq(characterProgress.userId, userId),
          eq(characterProgress.reading, true),
          eq(characterProgress.writing, true),
          eq(characterProgress.radical, true),
          gte(characterProgress.characterIndex, startIndex),
          lt(characterProgress.characterIndex, 3000)
        )
      );

    const masteredSet = new Set(masteredIndices.map(r => r.characterIndex));
    
    for (let i = startIndex; i < 3000; i++) {
      if (!masteredSet.has(i)) {
        return i;
      }
    }
    
    return 3000;
  }

  // Saved items operations
  async getSavedItems(userId: string): Promise<SavedItem[]> {
    return db
      .select()
      .from(savedItems)
      .where(eq(savedItems.userId, userId))
      .orderBy(savedItems.savedAt);
  }

  async toggleSavedItem(userId: string, item: { type: string; chinese: string; pinyin: string; english: string }): Promise<{ saved: boolean }> {
    const [existing] = await db
      .select()
      .from(savedItems)
      .where(and(eq(savedItems.userId, userId), eq(savedItems.chinese, item.chinese)));

    if (existing) {
      await db.delete(savedItems).where(eq(savedItems.id, existing.id));
      return { saved: false };
    } else {
      await db.insert(savedItems).values({ userId, ...item });
      return { saved: true };
    }
  }

  // Chinese characters operations
  async getCharacter(index: number): Promise<ChineseCharacter | undefined> {
    const [result] = await db
      .select(this.characterSelectFields())
      .from(chineseCharacters)
      .leftJoin(radicalsSimp, eq(chineseCharacters.radicalIndex, radicalsSimp.index))
      .leftJoin(radicalsTrad, eq(chineseCharacters.radicalIndexTraditional, radicalsTrad.index))
      .where(eq(chineseCharacters.index, index));
    return result;
  }

  async getCharacters(startIndex: number, count: number): Promise<ChineseCharacter[]> {
    return db
      .select(this.characterSelectFields())
      .from(chineseCharacters)
      .leftJoin(radicalsSimp, eq(chineseCharacters.radicalIndex, radicalsSimp.index))
      .leftJoin(radicalsTrad, eq(chineseCharacters.radicalIndexTraditional, radicalsTrad.index))
      .where(
        and(
          gte(chineseCharacters.index, startIndex),
          lt(chineseCharacters.index, startIndex + count)
        )
      )
      .orderBy(chineseCharacters.index)
      .limit(count);
  }

  async getAllCharacters(): Promise<ChineseCharacter[]> {
    return db
      .select(this.characterSelectFields())
      .from(chineseCharacters)
      .leftJoin(radicalsSimp, eq(chineseCharacters.radicalIndex, radicalsSimp.index))
      .leftJoin(radicalsTrad, eq(chineseCharacters.radicalIndexTraditional, radicalsTrad.index))
      .orderBy(chineseCharacters.index);
  }

  // Returns all columns from the chinese_characters table directly (no joins) ordered by index.
  // Used for admin Excel export to represent the full table faithfully.
  async getAllCharactersRaw(): Promise<typeof chineseCharacters.$inferSelect[]> {
    return db
      .select()
      .from(chineseCharacters)
      .orderBy(chineseCharacters.index);
  }

  private characterSelectFields() {
    return {
      index: chineseCharacters.index,
      simplified: chineseCharacters.simplified,
      traditional: chineseCharacters.traditional,
      traditionalVariants: chineseCharacters.traditionalVariants,
      pinyin: chineseCharacters.pinyin,
      pinyin2: chineseCharacters.pinyin2,
      pinyin3: chineseCharacters.pinyin3,
      numberedPinyin: chineseCharacters.numberedPinyin,
      numberedPinyin2: chineseCharacters.numberedPinyin2,
      numberedPinyin3: chineseCharacters.numberedPinyin3,
      radicalIndex: chineseCharacters.radicalIndex,
      definition: chineseCharacters.definition,
      examples: chineseCharacters.examples,
      examplesTraditional: chineseCharacters.examplesTraditional,
      wordExamples: chineseCharacters.wordExamples,
      wordExamplesTraditional: chineseCharacters.wordExamplesTraditional,
      hskLevel: chineseCharacters.hskLevel,
      lesson: chineseCharacters.lesson,
      radical: radicalsSimp.simplified,
      radicalPinyin: radicalsSimp.pinyin,
      // Traditional radical: use dedicated traditional radical if set, else fall back to simplified radical's traditional form
      radicalTraditional: sql<string | null>`COALESCE(${radicalsTrad.traditional}, ${radicalsSimp.traditional})`,
      radicalPinyinTraditional: sql<string | null>`COALESCE(${radicalsTrad.pinyin}, ${radicalsSimp.pinyin})`,
    };
  }

  async getCharactersByLesson(lesson: number): Promise<ChineseCharacter[]> {
    return db
      .select(this.characterSelectFields())
      .from(chineseCharacters)
      .leftJoin(radicalsSimp, eq(chineseCharacters.radicalIndex, radicalsSimp.index))
      .leftJoin(radicalsTrad, eq(chineseCharacters.radicalIndexTraditional, radicalsTrad.index))
      .where(eq(chineseCharacters.lesson, lesson))
      .orderBy(chineseCharacters.index);
  }

  async getCharactersByLessonRange(lessonStart: number, lessonEnd: number): Promise<ChineseCharacter[]> {
    return db
      .select(this.characterSelectFields())
      .from(chineseCharacters)
      .leftJoin(radicalsSimp, eq(chineseCharacters.radicalIndex, radicalsSimp.index))
      .leftJoin(radicalsTrad, eq(chineseCharacters.radicalIndexTraditional, radicalsTrad.index))
      .where(and(gte(chineseCharacters.lesson, lessonStart), lte(chineseCharacters.lesson, lessonEnd)))
      .orderBy(chineseCharacters.index);
  }

  async getBrowseCharacters(): Promise<{ index: number; simplified: string; traditional: string; pinyin: string; hskLevel: number; lesson: number | null }[]> {
    return db
      .select({
        index: chineseCharacters.index,
        simplified: chineseCharacters.simplified,
        traditional: chineseCharacters.traditional,
        pinyin: chineseCharacters.pinyin,
        hskLevel: chineseCharacters.hskLevel,
        lesson: chineseCharacters.lesson,
      })
      .from(chineseCharacters)
      .orderBy(chineseCharacters.index);
  }

  async getFilteredCharacters(userId: string, page: number, pageSize: number, filters: CharacterFilters): Promise<FilteredCharactersResult> {
    const offset = page * pageSize;
    
    // Build WHERE conditions
    const conditions: any[] = [];
    
    // HSK level filter
    if (filters.hskLevels && filters.hskLevels.length > 0) {
      conditions.push(inArray(chineseCharacters.hskLevel, filters.hskLevels));
    }
    
    // Progress filters - we need to LEFT JOIN with characterProgress
    // If any progress filter is active, we filter for characters that are NOT mastered in that area
    const progressConditions: any[] = [];
    
    if (filters.filterReading) {
      // Show only characters where reading is NOT mastered (progress.reading = false OR progress is null)
      progressConditions.push(
        or(
          eq(characterProgress.reading, false),
          isNull(characterProgress.reading)
        )
      );
    }
    
    if (filters.filterWriting) {
      progressConditions.push(
        or(
          eq(characterProgress.writing, false),
          isNull(characterProgress.writing)
        )
      );
    }
    
    if (filters.filterRadical) {
      progressConditions.push(
        or(
          eq(characterProgress.radical, false),
          isNull(characterProgress.radical)
        )
      );
    }
    
    // Build the query with LEFT JOINs for both progress and radicals
    let query = db
      .select(this.characterSelectFields())
      .from(chineseCharacters)
      .leftJoin(radicalsSimp, eq(chineseCharacters.radicalIndex, radicalsSimp.index))
      .leftJoin(radicalsTrad, eq(chineseCharacters.radicalIndexTraditional, radicalsTrad.index))
      .leftJoin(
        characterProgress,
        and(
          eq(characterProgress.characterIndex, chineseCharacters.index),
          eq(characterProgress.userId, userId)
        )
      )
      .$dynamic();
    
    // Apply all conditions
    const allConditions = [...conditions, ...progressConditions];
    if (allConditions.length > 0) {
      query = query.where(and(...allConditions));
    }
    
    // Get total count
    const countResult = await query;
    const total = countResult.length;
    
    // Get paginated results
    const characters = await query
      .orderBy(chineseCharacters.index)
      .limit(pageSize)
      .offset(offset);
    
    return {
      characters: characters as ChineseCharacter[],
      total
    };
  }

  async getRandomCharactersForQuiz(hskLevels: number[], count: number, excludeIndices: number[] = []): Promise<ChineseCharacter[]> {
    const conditions: any[] = [inArray(chineseCharacters.hskLevel, hskLevels)];

    if (excludeIndices.length > 0) {
      conditions.push(notInArray(chineseCharacters.index, excludeIndices));
    }

    const results = await db
      .select(this.characterSelectFields())
      .from(chineseCharacters)
      .leftJoin(radicalsSimp, eq(chineseCharacters.radicalIndex, radicalsSimp.index))
      .leftJoin(radicalsTrad, eq(chineseCharacters.radicalIndexTraditional, radicalsTrad.index))
      .where(and(...conditions))
      .orderBy(sql`RANDOM()`)
      .limit(count);
    return results as ChineseCharacter[];
  }

  async searchCharacters(searchTerm: string, limit: number = 50): Promise<ChineseCharacter[]> {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();

    if (!lowerSearchTerm) {
      return [];
    }

    const results = await db
      .select(this.characterSelectFields())
      .from(chineseCharacters)
      .leftJoin(radicalsSimp, eq(chineseCharacters.radicalIndex, radicalsSimp.index))
      .leftJoin(radicalsTrad, eq(chineseCharacters.radicalIndexTraditional, radicalsTrad.index))
      .where(
        or(
          eq(chineseCharacters.simplified, searchTerm),
          eq(chineseCharacters.traditional, searchTerm),
          like(chineseCharacters.pinyin, `%${lowerSearchTerm}%`),
          sql`LOWER(array_to_string(${chineseCharacters.definition}, ' ')) LIKE ${`%${lowerSearchTerm}%`}`
        )
      )
      .orderBy(chineseCharacters.index)
      .limit(limit);
    
    return results;
  }

  async updateCharactersBatch(updates: CharacterUpdate[]): Promise<number> {
    if (updates.length === 0) return 0;
    let count = 0;
    await db.transaction(async (tx) => {
      for (const update of updates) {
        const { index: idx } = update;
        const setFields: Partial<typeof chineseCharacters.$inferInsert> = {};
        if ('lesson' in update) setFields.lesson = update.lesson ?? null;
        if ('hskLevel' in update && update.hskLevel !== undefined) setFields.hskLevel = update.hskLevel;
        if ('simplified' in update && update.simplified) setFields.simplified = update.simplified;
        if ('traditional' in update && update.traditional) setFields.traditional = update.traditional;
        if ('traditionalVariants' in update) setFields.traditionalVariants = update.traditionalVariants ?? null;
        if ('radicalIndex' in update) setFields.radicalIndex = update.radicalIndex ?? null;
        if ('radicalIndexTraditional' in update) setFields.radicalIndexTraditional = update.radicalIndexTraditional ?? null;
        if ('definition' in update && Array.isArray(update.definition)) setFields.definition = update.definition;
        if ('examples' in update && update.examples !== undefined) setFields.examples = update.examples;
        if ('examplesTraditional' in update) setFields.examplesTraditional = update.examplesTraditional ?? null;
        if ('wordExamples' in update) setFields.wordExamples = update.wordExamples ?? null;
        if ('wordExamplesTraditional' in update) setFields.wordExamplesTraditional = update.wordExamplesTraditional ?? null;
        if ('pinyin' in update && update.pinyin) setFields.pinyin = update.pinyin;
        if ('pinyin2' in update) setFields.pinyin2 = update.pinyin2 ?? null;
        if ('pinyin3' in update) setFields.pinyin3 = update.pinyin3 ?? null;
        if ('numberedPinyin' in update) setFields.numberedPinyin = update.numberedPinyin ?? null;
        if ('numberedPinyin2' in update) setFields.numberedPinyin2 = update.numberedPinyin2 ?? null;
        if ('numberedPinyin3' in update) setFields.numberedPinyin3 = update.numberedPinyin3 ?? null;
        if (Object.keys(setFields).length > 0) {
          const rows = await tx
            .update(chineseCharacters)
            .set(setFields)
            .where(eq(chineseCharacters.index, idx))
            .returning({ index: chineseCharacters.index });
          count += rows.length;
        }
      }
    });
    return count;
  }

  // Quiz feedback cache
  async getFeedbackCache(blanked: string, character: string): Promise<string | null> {
    const [row] = await db
      .select({ feedback: quizFeedbackCache.feedback })
      .from(quizFeedbackCache)
      .where(and(eq(quizFeedbackCache.blanked, blanked), eq(quizFeedbackCache.character, character)))
      .limit(1);
    return row?.feedback ?? null;
  }

  async setFeedbackCache(blanked: string, character: string, feedback: string): Promise<void> {
    await db
      .insert(quizFeedbackCache)
      .values({ blanked, character, feedback })
      .onConflictDoNothing();
  }

  // Generated sentences cache
  async getGeneratedSentences(characterIndex: number): Promise<{ sentence: string; blanked: string; translation: string }[]> {
    return db
      .select({
        sentence: generatedSentences.sentence,
        blanked: generatedSentences.blanked,
        translation: generatedSentences.translation,
      })
      .from(generatedSentences)
      .where(eq(generatedSentences.characterIndex, characterIndex));
  }

  async saveGeneratedSentence(characterIndex: number, sentence: string, blanked: string, translation: string): Promise<void> {
    await db.insert(generatedSentences).values({ characterIndex, sentence, blanked, translation });
  }

  // ── Word vocabulary ──────────────────────────────────────────────────────────

  async getRandomWordsForQuiz(hskLevels: number[], count: number, excludeIds: number[] = []): Promise<ChineseWord[]> {
    const conditions: any[] = [inArray(chineseWords.hskLevel, hskLevels)];
    if (excludeIds.length > 0) {
      conditions.push(notInArray(chineseWords.id, excludeIds));
    }
    return db
      .select()
      .from(chineseWords)
      .where(and(...conditions))
      .orderBy(sql`RANDOM()`)
      .limit(count) as Promise<ChineseWord[]>;
  }

  async getWordChoices(correctId: number, hskLevel: number, count: number): Promise<ChineseWord[]> {
    // Return distractors from the same or adjacent HSK level, excluding the correct word
    const results = await db
      .select()
      .from(chineseWords)
      .where(and(
        notInArray(chineseWords.id, [correctId]),
        inArray(chineseWords.hskLevel, [Math.max(1, hskLevel - 1), hskLevel, Math.min(6, hskLevel + 1)])
      ))
      .orderBy(sql`RANDOM()`)
      .limit(count);
    return results as ChineseWord[];
  }

  async getWordById(id: number): Promise<ChineseWord | undefined> {
    const [word] = await db.select().from(chineseWords).where(eq(chineseWords.id, id));
    return word as ChineseWord | undefined;
  }

  async updateWordExamples(id: number, examples: { chinese: string; english: string }[]): Promise<void> {
    await db.update(chineseWords).set({ examples }).where(eq(chineseWords.id, id));
  }

  async getWordProgressForUser(userId: string, wordId: number): Promise<WordProgress | undefined> {
    const [row] = await db
      .select()
      .from(wordProgress)
      .where(and(eq(wordProgress.userId, userId), eq(wordProgress.wordId, wordId)));
    return row;
  }

  async getWordProgressStats(userId: string): Promise<{ known: number; total: number }> {
    const [knownCount] = await db
      .select({ value: count() })
      .from(wordProgress)
      .where(and(eq(wordProgress.userId, userId), eq(wordProgress.known, true)));
    const [totalCount] = await db
      .select({ value: count() })
      .from(chineseWords);
    return { known: knownCount.value, total: totalCount.value };
  }

  async upsertWordProgress(userId: string, wordId: number, known: boolean): Promise<void> {
    await db
      .insert(wordProgress)
      .values({ userId, wordId, known })
      .onConflictDoUpdate({
        target: [wordProgress.userId, wordProgress.wordId],
        set: { known, updatedAt: new Date() },
      });
  }

  async getFilteredWords(userId: string, page: number, pageSize: number, hskLevels?: number[], filterUnknown?: boolean): Promise<{ words: ChineseWord[]; total: number }> {
    const offset = page * pageSize;
    const conditions: any[] = [];

    if (hskLevels && hskLevels.length > 0) {
      conditions.push(inArray(chineseWords.hskLevel, hskLevels));
    }

    if (filterUnknown) {
      // Exclude words marked as known by this user
      const knownSubquery = db
        .select({ wordId: wordProgress.wordId })
        .from(wordProgress)
        .where(and(eq(wordProgress.userId, userId), eq(wordProgress.known, true)));
      conditions.push(notInArray(chineseWords.id, knownSubquery));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(chineseWords)
      .where(whereClause);

    const words = await db
      .select()
      .from(chineseWords)
      .where(whereClause)
      .orderBy(chineseWords.hskLevel, chineseWords.id)
      .limit(pageSize)
      .offset(offset);

    return { words: words as ChineseWord[], total };
  }

  async getWordBatchProgress(userId: string, wordIds: number[]): Promise<WordProgress[]> {
    if (wordIds.length === 0) return [];
    return db
      .select()
      .from(wordProgress)
      .where(and(eq(wordProgress.userId, userId), inArray(wordProgress.wordId, wordIds))) as Promise<WordProgress[]>;
  }
}

export const storage = new DatabaseStorage();
