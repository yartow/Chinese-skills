// Replit Auth and API routes - blueprint:javascript_log_in_with_replit
import Anthropic from "@anthropic-ai/sdk";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, type CharacterUpdate } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertUserSettingsSchema, insertCharacterProgressSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const anthropic = new Anthropic();

// Columns exported to Excel — all actual chinese_characters table columns (in order)
const EXPORT_COLUMNS = [
  "index", "simplified", "traditional", "traditionalVariants",
  "pinyin", "pinyin2", "pinyin3",
  "numberedPinyin", "numberedPinyin2", "numberedPinyin3",
  "radicalIndex", "hskLevel", "lesson",
  "definition", "examples", "wordExamples",
];


export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User settings routes
  app.get('/api/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let settings = await storage.getUserSettings(userId);
      
      // Create default settings if they don't exist
      if (!settings) {
        settings = await storage.upsertUserSettings({
          userId,
          currentLevel: 0,
          dailyCharCount: 5,
          preferTraditional: true,
        });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch('/api/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settingsData = insertUserSettingsSchema.parse({
        userId,
        ...req.body,
      });
      
      const settings = await storage.upsertUserSettings(settingsData);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid settings data", errors: error.errors });
      } else {
        console.error("Error updating settings:", error);
        res.status(500).json({ message: "Failed to update settings" });
      }
    }
  });

  // Character routes
  // IMPORTANT: Specific routes must come before generic :index route to avoid matching issues
  
  // Search characters
  app.get('/api/characters/search', isAuthenticated, async (req: any, res) => {
    try {
      const searchTerm = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 50;
      
      if (!searchTerm || searchTerm.trim() === '') {
        return res.json([]);
      }
      
      if (limit < 1 || limit > 100) {
        return res.status(400).json({ message: "Invalid limit parameter (1-100)" });
      }

      const results = await storage.searchCharacters(searchTerm, limit);
      res.json(results);
    } catch (error) {
      console.error("Error searching characters:", error);
      res.status(500).json({ message: "Failed to search characters" });
    }
  });

  // Filtered characters query with pagination
  app.get('/api/characters/filtered', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const page = parseInt(req.query.page as string) || 0;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      
      if (page < 0 || pageSize < 1 || pageSize > 100) {
        return res.status(400).json({ message: "Invalid pagination parameters" });
      }

      // Parse filter parameters
      const filters: any = {};
      
      if (req.query.hskLevels) {
        const levels = (req.query.hskLevels as string).split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 6);
        if (levels.length > 0) {
          filters.hskLevels = levels;
        }
      }
      
      if (req.query.filterReading === 'true') {
        filters.filterReading = true;
      }
      
      if (req.query.filterWriting === 'true') {
        filters.filterWriting = true;
      }
      
      if (req.query.filterRadical === 'true') {
        filters.filterRadical = true;
      }

      const result = await storage.getFilteredCharacters(userId, page, pageSize, filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching filtered characters:", error);
      res.status(500).json({ message: "Failed to fetch filtered characters" });
    }
  });

  app.get('/api/characters/range/:start/:count', isAuthenticated, async (req: any, res) => {
    try {
      const start = parseInt(req.params.start);
      const count = parseInt(req.params.count);
      
      if (isNaN(start) || isNaN(count) || start < 0 || start >= 3000 || count < 1 || count > 300) {
        return res.status(400).json({ message: "Invalid range parameters" });
      }

      const safeCount = Math.min(count, 3000 - start);
      const characters = await storage.getCharacters(start, safeCount);
      res.json(characters);
    } catch (error) {
      console.error("Error fetching characters:", error);
      res.status(500).json({ message: "Failed to fetch characters" });
    }
  });

  // Browse characters — lightweight list (index, simplified, traditional, pinyin, hskLevel, lesson)
  app.get('/api/characters/browse', isAuthenticated, async (_req, res) => {
    try {
      const chars = await storage.getBrowseCharacters();
      res.json(chars);
    } catch (error) {
      console.error("Error fetching browse characters:", error);
      res.status(500).json({ message: "Failed to fetch characters" });
    }
  });

  // Lesson-based character filter — query params: lesson OR (lessonStart + lessonEnd)
  app.get('/api/characters/by-lesson', isAuthenticated, async (req, res) => {
    try {
      const { lesson, lessonStart, lessonEnd } = req.query as Record<string, string | undefined>;
      if (lesson !== undefined) {
        const n = parseInt(lesson);
        if (isNaN(n) || n < 1) return res.status(400).json({ message: "Invalid lesson number" });
        const chars = await storage.getCharactersByLesson(n);
        return res.json(chars);
      }
      if (lessonStart !== undefined && lessonEnd !== undefined) {
        const s = parseInt(lessonStart);
        const e = parseInt(lessonEnd);
        if (isNaN(s) || isNaN(e) || s < 1 || e < s) return res.status(400).json({ message: "Invalid lesson range" });
        const chars = await storage.getCharactersByLessonRange(s, e);
        return res.json(chars);
      }
      return res.status(400).json({ message: "Provide lesson or lessonStart+lessonEnd query params" });
    } catch (error) {
      console.error("Error fetching characters by lesson:", error);
      res.status(500).json({ message: "Failed to fetch characters" });
    }
  });

  // Generic :index route must come LAST after all specific routes
  app.get('/api/characters/:index', isAuthenticated, async (req: any, res) => {
    try {
      const index = parseInt(req.params.index);
      if (isNaN(index) || index < 0 || index >= 3000) {
        return res.status(400).json({ message: "Invalid character index" });
      }

      const character = await storage.getCharacter(index);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }

      res.json(character);
    } catch (error) {
      console.error("Error fetching character:", error);
      res.status(500).json({ message: "Failed to fetch character" });
    }
  });

  // Character progress routes
  // IMPORTANT: Specific routes must come before generic :characterIndex route
  
  app.get('/api/progress/batch', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const indicesParam = req.query.indices as string;
      
      if (!indicesParam) {
        return res.status(400).json({ message: "Missing indices parameter" });
      }

      const indices = indicesParam.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n < 3000);
      
      if (indices.length === 0) {
        return res.json([]);
      }
      
      if (indices.length > 300) {
        return res.status(400).json({ message: "Too many indices (max 300)" });
      }

      const progress = await storage.getBatchCharacterProgress(userId, indices);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching batch progress:", error);
      res.status(500).json({ message: "Failed to fetch batch progress" });
    }
  });

  app.get('/api/progress/range/:start/:count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const start = parseInt(req.params.start);
      const count = parseInt(req.params.count);
      
      if (isNaN(start) || isNaN(count) || start < 0 || start >= 3000 || count < 1 || count > 300) {
        return res.status(400).json({ message: "Invalid range parameters" });
      }

      const safeCount = Math.min(count, 3000 - start);
      const progress = await storage.getUserCharacterProgress(userId, start, safeCount);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  // Mastery statistics - counts for each mastery type (must come BEFORE :characterIndex)
  app.get('/api/progress/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getMasteryStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching mastery stats:", error);
      res.status(500).json({ message: "Failed to fetch mastery stats" });
    }
  });

  // Get first non-mastered character index starting from a given index
  app.get('/api/progress/first-non-mastered/:startIndex', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const startIndex = parseInt(req.params.startIndex);
      
      if (isNaN(startIndex) || startIndex < 0 || startIndex >= 3000) {
        return res.status(400).json({ message: "Invalid start index" });
      }

      const firstNonMastered = await storage.getFirstNonMasteredIndex(userId, startIndex);
      res.json({ index: firstNonMastered });
    } catch (error) {
      console.error("Error finding first non-mastered character:", error);
      res.status(500).json({ message: "Failed to find first non-mastered character" });
    }
  });

  // Generic :characterIndex route must come LAST
  app.get('/api/progress/:characterIndex', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const characterIndex = parseInt(req.params.characterIndex);
      
      if (isNaN(characterIndex) || characterIndex < 0 || characterIndex >= 3000) {
        return res.status(400).json({ message: "Invalid character index" });
      }

      const progress = await storage.getCharacterProgress(userId, characterIndex);
      res.json(progress || { reading: false, writing: false, radical: false });
    } catch (error) {
      console.error("Error fetching progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  app.post('/api/progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const progressData = insertCharacterProgressSchema.parse({
        userId,
        ...req.body,
      });

      const progress = await storage.upsertCharacterProgress(progressData);
      res.json(progress);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid progress data", errors: error.errors });
      } else {
        console.error("Error updating progress:", error);
        res.status(500).json({ message: "Failed to update progress" });
      }
    }
  });

  // Admin: Export all characters as Excel (full chinese_characters table, ordered by index)
  app.get('/api/admin/characters/export', isAuthenticated, async (_req, res) => {
    try {
      const characters = await storage.getAllCharactersRaw();

      const rows = characters.map((c) => ({
        index: c.index,
        simplified: c.simplified,
        traditional: c.traditional,
        traditionalVariants: Array.isArray(c.traditionalVariants) ? c.traditionalVariants.join(", ") : "",
        pinyin: c.pinyin,
        pinyin2: c.pinyin2 ?? "",
        pinyin3: c.pinyin3 ?? "",
        numberedPinyin: c.numberedPinyin ?? "",
        numberedPinyin2: c.numberedPinyin2 ?? "",
        numberedPinyin3: c.numberedPinyin3 ?? "",
        radicalIndex: c.radicalIndex ?? "",
        hskLevel: c.hskLevel,
        lesson: c.lesson ?? "",
        definition: Array.isArray(c.definition) ? c.definition.join(" | ") : "",
        examples: JSON.stringify(c.examples),
        wordExamples: c.wordExamples != null ? JSON.stringify(c.wordExamples) : "",
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS });
      XLSX.utils.book_append_sheet(wb, ws, "Characters");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Disposition", "attachment; filename=\"chinese_characters.xlsx\"");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buf);
    } catch (error) {
      console.error("Error exporting characters:", error);
      res.status(500).json({ message: "Failed to export characters" });
    }
  });

  // Admin: Import characters from Excel (updates writable fields matched by index)
  app.post('/api/admin/characters/import', isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      const file = (req as Express.Request & { file?: Express.Multer.File }).file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Validate file type: must be .xlsx by MIME type or filename extension
      const allowedMimes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
      ];
      const hasValidMime = allowedMimes.includes(file.mimetype);
      const hasValidExt = file.originalname.toLowerCase().endsWith(".xlsx");
      if (!hasValidMime && !hasValidExt) {
        return res.status(400).json({ message: "Only .xlsx files are accepted" });
      }

      const wb = XLSX.read(file.buffer, { type: "buffer" });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ message: "Excel file has no sheets" });
      }

      type ImportRow = Record<string, string | number | null>;
      const rows = XLSX.utils.sheet_to_json<ImportRow>(wb.Sheets[sheetName], { defval: null });

      if (rows.length === 0) {
        return res.status(400).json({ message: "Excel file has no data rows" });
      }

      const updates: CharacterUpdate[] = [];
      let skippedCount = 0;

      for (const row of rows) {
        const rawIdx = row["index"];
        const idx = typeof rawIdx === "number" ? rawIdx : parseInt(String(rawIdx ?? ""));
        if (isNaN(idx) || idx < 0 || idx >= 3000) {
          skippedCount++;
          continue;
        }

        const update: CharacterUpdate = { index: idx };
        let hasField = false;

        if ("lesson" in row) {
          const v = row["lesson"];
          const n = (v === null || v === "") ? null : Number(v);
          update.lesson = (n !== null && !isNaN(n)) ? n : null;
          hasField = true;
        }
        if ("hskLevel" in row) {
          const v = row["hskLevel"];
          const n = (v === null || v === "") ? undefined : Number(v);
          if (n !== undefined && !isNaN(n)) { update.hskLevel = n; hasField = true; }
        }
        // Required string fields — only update if non-empty value provided
        if ("simplified" in row && row["simplified"] !== null && row["simplified"] !== "") {
          update.simplified = String(row["simplified"]); hasField = true;
        }
        if ("traditional" in row && row["traditional"] !== null && row["traditional"] !== "") {
          update.traditional = String(row["traditional"]); hasField = true;
        }
        if ("pinyin" in row && row["pinyin"] !== null && row["pinyin"] !== "") {
          update.pinyin = String(row["pinyin"]); hasField = true;
        }
        // Nullable string fields — set to null when empty, string when present
        if ("pinyin2" in row) {
          const v = row["pinyin2"];
          update.pinyin2 = (v === null || v === "") ? null : String(v); hasField = true;
        }
        if ("pinyin3" in row) {
          const v = row["pinyin3"];
          update.pinyin3 = (v === null || v === "") ? null : String(v); hasField = true;
        }
        if ("numberedPinyin" in row) {
          const v = row["numberedPinyin"];
          update.numberedPinyin = (v === null || v === "") ? null : String(v); hasField = true;
        }
        if ("numberedPinyin2" in row) {
          const v = row["numberedPinyin2"];
          update.numberedPinyin2 = (v === null || v === "") ? null : String(v); hasField = true;
        }
        if ("numberedPinyin3" in row) {
          const v = row["numberedPinyin3"];
          update.numberedPinyin3 = (v === null || v === "") ? null : String(v); hasField = true;
        }
        // traditionalVariants: exported as comma-separated string, import splits back to array
        if ("traditionalVariants" in row) {
          const v = row["traditionalVariants"];
          if (v === null || v === "") {
            update.traditionalVariants = null;
          } else {
            update.traditionalVariants = String(v).split(",").map((s) => s.trim()).filter(Boolean);
          }
          hasField = true;
        }
        // radicalIndex: nullable integer
        if ("radicalIndex" in row) {
          const v = row["radicalIndex"];
          const n = (v === null || v === "") ? null : Number(v);
          update.radicalIndex = (n !== null && !isNaN(n)) ? n : null;
          hasField = true;
        }
        // definition: exported as " | "-joined string, import splits back to array
        if ("definition" in row) {
          const v = row["definition"];
          if (v !== null && v !== "") {
            update.definition = String(v).split("|").map((s) => s.trim()).filter(Boolean);
            hasField = true;
          }
        }
        // examples: exported as JSON string, import parses back to object
        if ("examples" in row) {
          const v = row["examples"];
          if (v !== null && v !== "") {
            try {
              update.examples = JSON.parse(String(v));
              hasField = true;
            } catch {
              // Skip malformed examples JSON — do not overwrite existing data
            }
          }
        }
        // wordExamples: exported as JSON string, import parses back to object
        if ("wordExamples" in row) {
          const v = row["wordExamples"];
          if (v === null || v === "") {
            update.wordExamples = null;
            hasField = true;
          } else {
            try {
              update.wordExamples = JSON.parse(String(v));
              hasField = true;
            } catch {
              // Skip malformed wordExamples JSON — do not overwrite existing data
            }
          }
        }

        if (hasField) updates.push(update);
      }

      const updatedCount = await storage.updateCharactersBatch(updates);

      res.json({
        message: `Successfully updated ${updatedCount} characters`,
        updated: updatedCount,
        skipped: skippedCount,
        total: rows.length,
      });
    } catch (error) {
      console.error("Error importing characters:", error);
      res.status(500).json({ message: "Failed to import characters" });
    }
  });
  
  // GET /api/quiz/question?levels=1,2,3
  // Returns a random fill-in-the-blank question from the requested HSK levels
  app.get('/api/quiz/question', isAuthenticated, async (req: any, res) => {
    try {
      const levelsParam = (req.query.levels as string) || "1,2,3";
      const hskLevels = levelsParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n) && n >= 1 && n <= 6);

      if (hskLevels.length === 0) {
        return res.status(400).json({ message: "No valid HSK levels provided" });
      }

      // Sample randomly across the full set for the requested HSK levels (ORDER BY RANDOM())
      const POOL_SIZE = 200;
      const pool = await storage.getRandomCharactersForQuiz(hskLevels, POOL_SIZE);

      if (pool.length === 0) {
        return res.status(404).json({ message: "No characters found for selected levels" });
      }

      // CJK unicode range — English translations containing these are likely spoilers
      const CJK_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF]/;

      // Pick the first character from the already-randomised pool that has a usable example
      let chosen = null;
      let chosenExample = null;

      for (const char of pool) {
        const examples = char.examples as { chinese: string; english: string }[];
        const valid = examples?.filter((e) => {
          if (!e.chinese?.includes(char.simplified)) return false;
          // Chinese sentence must be at least 5 characters
          if (e.chinese.length < 5) return false;
          // Character must appear exactly once — multiple occurrences would leave one visible
          if (e.chinese.split(char.simplified).length !== 2) return false;
          // The blanked form must leave content on both sides of the blank
          const blanked = e.chinese.replace(char.simplified, "＿");
          const parts = blanked.split("＿");
          if (parts.length < 2 || !parts[0] || !parts[1]) return false;
          // English translation must not contain CJK characters (would reveal the answer)
          if (CJK_REGEX.test(e.english)) return false;
          return true;
        });
        if (valid && valid.length > 0) {
          chosen = char;
          chosenExample = valid[Math.floor(Math.random() * valid.length)];
          break;
        }
      }

      if (!chosen || !chosenExample) {
        return res.status(404).json({ message: "Could not find a suitable question" });
      }

      const blanked = chosenExample.chinese.replace(chosen.simplified, "＿");

      res.json({
        characterIndex: chosen.index,
        character: chosen.simplified,
        traditional: chosen.traditional,
        traditionalVariants: Array.isArray(chosen.traditionalVariants) ? chosen.traditionalVariants : null,
        pinyin: chosen.pinyin,
        pinyin2: chosen.pinyin2 ?? null,
        definition: Array.isArray(chosen.definition) ? chosen.definition : [chosen.definition],
        hskLevel: chosen.hskLevel,
        sentence: chosenExample.chinese,
        blanked,
        translation: chosenExample.english,
      });
    } catch (error) {
      console.error("Error generating quiz question:", error);
      res.status(500).json({ message: "Failed to generate question" });
    }
  });

  // GET /api/quiz/choices?correctIndex=5&hskLevel=2&levels=1,2,3
  // Returns 3 distractor characters (wrong answers) for multiple choice questions.
  // Picks characters from the same HSK levels, excluding the correct answer.
  app.get('/api/quiz/choices', isAuthenticated, async (req: any, res) => {
    try {
      const correctIndex = parseInt(req.query.correctIndex as string);
      const hskLevel = parseInt(req.query.hskLevel as string);
      const levelsParam = (req.query.levels as string) || "1,2,3";

      const hskLevels = levelsParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n) && n >= 1 && n <= 6);

      if (isNaN(correctIndex) || isNaN(hskLevel)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      // Accumulate candidates across pages until we have ≥3 same-level distractors
      // (or exhaust pages). Starting from page 0 avoids the stale-randomPage problem
      // where a high random offset could land beyond the available character count.
      const POOL_SIZE = 80;
      const pool: Awaited<ReturnType<typeof storage.getFilteredCharacters>>["characters"] = [];
      for (let page = 0; page <= 10; page++) {
        const result = await storage.getFilteredCharacters(
          req.user.claims.sub,
          page,
          POOL_SIZE,
          { hskLevels }
        );
        if (result.characters.length === 0) break;
        pool.push(...result.characters.filter((c) => c.index !== correctIndex));
        const sameLevelSoFar = pool.filter((c) => c.hskLevel === hskLevel);
        if (sameLevelSoFar.length >= 3) break;
      }

      // Shuffle the accumulated pool
      pool.sort(() => Math.random() - 0.5);

      // Pick 3 distractors — prefer same HSK level for more meaningful difficulty,
      // fill remainder from any level if not enough same-level candidates
      const sameLevelPool = pool.filter((c) => c.hskLevel === hskLevel);
      let distractors = sameLevelPool.slice(0, 3);
      if (distractors.length < 3) {
        const chosen = new Set(distractors.map((c) => c.index));
        const extras = pool.filter((c) => !chosen.has(c.index)).slice(0, 3 - distractors.length);
        distractors = [...distractors, ...extras];
      }

      const choices = distractors.map((c) => ({
        character: c.simplified,
        traditional: c.traditional,
      }));

      res.json(choices);
    } catch (error) {
      console.error("Error fetching choices:", error);
      res.status(500).json({ message: "Failed to fetch choices" });
    }
  });


  // POST /api/quiz/check
  // Checks the user's answer and returns AI-generated feedback via Claude
  app.post('/api/quiz/check', isAuthenticated, async (req: any, res) => {
    try {
      const { character, answer, blanked, translation, definition, pinyin, hskLevel } = req.body;

      if (!character || !answer) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const isCorrect = answer.trim() === character;
      const fullSentence = blanked.replace("＿", character);

      // Generate feedback with Claude
      const prompt = `A student is studying for HSK ${hskLevel}. They saw this fill-in-the-blank:

Sentence: ${blanked}
English: ${translation}
Correct answer: ${character} (${pinyin}) — ${Array.isArray(definition) ? definition.join(" | ") : definition}
Student answered: "${answer.trim()}"
Result: ${isCorrect ? "CORRECT" : "WRONG"}

Write 2-3 sentences of feedback in English:
- If CORRECT: explain why ${character} fits this context, give one memory tip or usage note
- If WRONG: gently explain the error, clarify what ${character} means here, and if "${answer.trim()}" is a real character briefly say what it means
Keep it concise and encouraging for a language learner.`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });

      const feedback = (response.content[0] as { text: string }).text.trim();

      res.json({
        correct: isCorrect,
        correctAnswer: character,
        fullSentence,
        feedback,
      });
    } catch (error) {
      console.error("Error checking quiz answer:", error);
      res.status(500).json({ message: "Failed to check answer" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
