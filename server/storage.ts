// Replit Auth storage implementation - blueprint:javascript_log_in_with_replit
import {
  users,
  userSettings,
  characterProgress,
  chineseCharacters,
  radicals,
  type User,
  type UpsertUser,
  type UserSettings,
  type InsertUserSettings,
  type CharacterProgress,
  type InsertCharacterProgress,
  type ChineseCharacter,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lt, inArray, or, isNull, like, sql } from "drizzle-orm";

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
  examples?: unknown;
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
  
  // Chinese characters operations
  getCharacter(index: number): Promise<ChineseCharacter | undefined>;
  getCharacters(startIndex: number, count: number): Promise<ChineseCharacter[]>;
  getAllCharacters(): Promise<ChineseCharacter[]>;
  getAllCharactersRaw(): Promise<typeof chineseCharacters.$inferSelect[]>;
  getFilteredCharacters(userId: string, page: number, pageSize: number, filters: CharacterFilters): Promise<FilteredCharactersResult>;
  updateCharactersBatch(updates: CharacterUpdate[]): Promise<number>;
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

  // Chinese characters operations
  async getCharacter(index: number): Promise<ChineseCharacter | undefined> {
    const [result] = await db
      .select({
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
        hskLevel: chineseCharacters.hskLevel,
        lesson: chineseCharacters.lesson,
        radical: radicals.simplified,
        radicalPinyin: radicals.pinyin,
      })
      .from(chineseCharacters)
      .leftJoin(radicals, eq(chineseCharacters.radicalIndex, radicals.index))
      .where(eq(chineseCharacters.index, index));
    
    return result;
  }

  async getCharacters(startIndex: number, count: number): Promise<ChineseCharacter[]> {
    const characters = await db
      .select({
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
        hskLevel: chineseCharacters.hskLevel,
        lesson: chineseCharacters.lesson,
        radical: radicals.simplified,
        radicalPinyin: radicals.pinyin,
      })
      .from(chineseCharacters)
      .leftJoin(radicals, eq(chineseCharacters.radicalIndex, radicals.index))
      .where(
        and(
          gte(chineseCharacters.index, startIndex),
          lt(chineseCharacters.index, startIndex + count)
        )
      )
      .orderBy(chineseCharacters.index)
      .limit(count);
    return characters;
  }

  async getAllCharacters(): Promise<ChineseCharacter[]> {
    const characters = await db
      .select({
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
        hskLevel: chineseCharacters.hskLevel,
        lesson: chineseCharacters.lesson,
        radical: radicals.simplified,
        radicalPinyin: radicals.pinyin,
      })
      .from(chineseCharacters)
      .leftJoin(radicals, eq(chineseCharacters.radicalIndex, radicals.index))
      .orderBy(chineseCharacters.index);
    return characters;
  }

  // Returns all columns from the chinese_characters table directly (no joins) ordered by index.
  // Used for admin Excel export to represent the full table faithfully.
  async getAllCharactersRaw(): Promise<typeof chineseCharacters.$inferSelect[]> {
    return db
      .select()
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
      .select({
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
        hskLevel: chineseCharacters.hskLevel,
        lesson: chineseCharacters.lesson,
        radical: radicals.simplified,
        radicalPinyin: radicals.pinyin,
      })
      .from(chineseCharacters)
      .leftJoin(radicals, eq(chineseCharacters.radicalIndex, radicals.index))
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

  async searchCharacters(searchTerm: string, limit: number = 50): Promise<ChineseCharacter[]> {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    
    if (!lowerSearchTerm) {
      return [];
    }

    // Search in simplified, traditional, pinyin, or definition (text array)
    // For definition array, we convert to string and search within it
    const results = await db
      .select({
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
        hskLevel: chineseCharacters.hskLevel,
        lesson: chineseCharacters.lesson,
        radical: radicals.simplified,
        radicalPinyin: radicals.pinyin,
      })
      .from(chineseCharacters)
      .leftJoin(radicals, eq(chineseCharacters.radicalIndex, radicals.index))
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
        if ('definition' in update && Array.isArray(update.definition)) setFields.definition = update.definition;
        if ('examples' in update && update.examples !== undefined) setFields.examples = update.examples;
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
}

export const storage = new DatabaseStorage();
