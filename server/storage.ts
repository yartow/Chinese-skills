// Replit Auth storage implementation - blueprint:javascript_log_in_with_replit
import {
  users,
  userSettings,
  characterProgress,
  chineseCharacters,
  type User,
  type UpsertUser,
  type UserSettings,
  type InsertUserSettings,
  type CharacterProgress,
  type InsertCharacterProgress,
  type ChineseCharacter,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lt } from "drizzle-orm";

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
  
  // Chinese characters operations
  getCharacter(index: number): Promise<ChineseCharacter | undefined>;
  getCharacters(startIndex: number, count: number): Promise<ChineseCharacter[]>;
  getAllCharacters(): Promise<ChineseCharacter[]>;
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

  // Chinese characters operations
  async getCharacter(index: number): Promise<ChineseCharacter | undefined> {
    const [character] = await db.select().from(chineseCharacters).where(eq(chineseCharacters.index, index));
    return character;
  }

  async getCharacters(startIndex: number, count: number): Promise<ChineseCharacter[]> {
    const characters = await db
      .select()
      .from(chineseCharacters)
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
    return await db.select().from(chineseCharacters);
  }
}

export const storage = new DatabaseStorage();
