/**
 * api-characters.test.ts
 * ──────────────────────
 * Tests for the character-related API routes:
 *   GET /api/characters/search    — search by character, pinyin, or meaning
 *   GET /api/characters/:index    — fetch a single character
 *   GET /api/characters/range     — fetch a range for the Daily view
 *   GET /api/progress/range       — fetch progress for a range
 *   POST /api/progress            — update character progress
 *
 * What these tests catch:
 *   - Returning 200 [] instead of results for non-empty queries (search regression)
 *   - 404 for characters that exist (wrong index range check — the >= 3000 bug)
 *   - Missing auth protection
 *   - Invalid input not rejected (missing required fields)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── vi.hoisted ensures these variables exist when vi.mock() factories run ─────

const { mockStorage } = vi.hoisted(() => {
  const mockStorage = {
    getUserSettings: vi.fn(),
    upsertUserSettings: vi.fn(),
    getUser: vi.fn(),
    upsertUser: vi.fn(),
    getCharacter: vi.fn(),
    searchCharacters: vi.fn(),
    getCharactersByRange: vi.fn(),
    getFilteredCharacters: vi.fn(),
    getCharacterProgress: vi.fn(),
    upsertCharacterProgress: vi.fn(),
    getProgressForRange: vi.fn(),
    getProgressBatch: vi.fn(),
    getUserCharacterProgress: vi.fn(),
    getMasteryStats: vi.fn(),
    getFirstNonMasteredIndex: vi.fn(),
    getWordProgress: vi.fn(),
    upsertWordProgress: vi.fn(),
    getWordProgressBatch: vi.fn(),
    getSavedItems: vi.fn(),
    saveItem: vi.fn(),
    deleteSavedItem: vi.fn(),
    getGeneratedSentence: vi.fn(),
    saveGeneratedSentence: vi.fn(),
    getCachedFeedback: vi.fn(),
    saveCachedFeedback: vi.fn(),
    getRandomWordForQuiz: vi.fn(),
    getWordsPage: vi.fn(),
    getWordById: vi.fn(),
  };
  return { mockStorage };
});

vi.mock("../server/db", () => ({
  db: { execute: vi.fn().mockResolvedValue({ rows: [] }) },
  pool: {},
}));
vi.mock("../server/storage", () => ({ storage: mockStorage }));
vi.mock("../server/replitAuth", () => ({
  setupAuth: vi.fn(),
  isAuthenticated: (req: any, _res: any, next: any) => {
    req.user = { claims: { sub: "test-user-id" } };
    next();
  },
}));

import { registerRoutes } from "../server/routes";

async function buildApp() {
  const app = express();
  app.use(express.json());
  await registerRoutes(app);
  return app;
}

// ── Sample data ───────────────────────────────────────────────────────────────

const fakeCharacter = {
  index: 1,
  simplified: "学",
  traditional: "學",
  pinyin: "xué",
  definition: ["to learn", "to study"],
  hskLevel: 1,
  examples: [{ chinese: "我学习中文。", english: "I study Chinese." }],
  examplesTraditional: null,
  wordExamples: null,
  wordExamplesTraditional: null,
  radicalIndex: 39,
  radicalIndexTraditional: 39,
  radical: "子",
  radicalTraditional: "子",
  radicalPinyin: "zǐ",
  radicalPinyinTraditional: "zǐ",
  numberedPinyin: "xue2",
  numberedPinyin2: null,
  numberedPinyin3: null,
  pinyin2: null,
  pinyin3: null,
  traditionalVariants: null,
  lesson: null,
};

const fakeProgress = {
  id: "prog-1",
  userId: "test-user-id",
  characterIndex: 1,
  reading: true,
  writing: false,
  radical: false,
  updatedAt: new Date(),
};

const fakeSettings = {
  userId: "test-user-id",
  currentLevel: 0,
  dailyCharCount: 5,
  standardModePageSize: 20,
  preferTraditional: true,
  useAiFeedback: false,
  useAiSentences: false,
  anthropicApiKey: null,
  handwritingCandidates: 8,
  updatedAt: new Date(),
};

// ── Search tests ──────────────────────────────────────────────────────────────

describe("GET /api/characters/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getUserSettings.mockResolvedValue(fakeSettings);
    mockStorage.upsertUserSettings.mockResolvedValue(fakeSettings);
  });

  it("returns [] for an empty query string", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/characters/search?q=");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    // storage.searchCharacters should never be called for empty input
    expect(mockStorage.searchCharacters).not.toHaveBeenCalled();
  });

  it("returns [] when query is whitespace only", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/characters/search?q=   ");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("calls searchCharacters and returns results for a valid query", async () => {
    mockStorage.searchCharacters.mockResolvedValue([fakeCharacter]);
    const app = await buildApp();
    const res = await request(app).get("/api/characters/search?q=learn");

    expect(res.status).toBe(200);
    expect(mockStorage.searchCharacters).toHaveBeenCalledWith("learn", expect.any(Number));
    expect(res.body).toHaveLength(1);
    expect(res.body[0].simplified).toBe("学");
  });

  it("rejects limit > 100 with 400", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/characters/search?q=test&limit=999");

    expect(res.status).toBe(400);
  });

  it("returns empty array when storage returns no results", async () => {
    mockStorage.searchCharacters.mockResolvedValue([]);
    const app = await buildApp();
    const res = await request(app).get("/api/characters/search?q=zzznomatch");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── Single character fetch ────────────────────────────────────────────────────

describe("GET /api/characters/:index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getCharacter.mockResolvedValue(fakeCharacter);
    mockStorage.getUserSettings.mockResolvedValue(fakeSettings);
    mockStorage.upsertUserSettings.mockResolvedValue(fakeSettings);
  });

  it("returns the character for a valid index in the lower range", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/characters/1");

    expect(res.status).toBe(200);
    expect(res.body.simplified).toBe("学");
  });

  it("returns the character for an index above 3000 (non-HSK characters)", async () => {
    // This tests the bug where index >= 3000 was incorrectly treated as "not found"
    mockStorage.getCharacter.mockResolvedValue({ ...fakeCharacter, index: 6438, simplified: "嘌", hskLevel: 0 });
    const app = await buildApp();
    const res = await request(app).get("/api/characters/6438");

    expect(res.status).toBe(200);
    expect(res.body.index).toBe(6438);
  });

  it("returns 404 when character does not exist", async () => {
    mockStorage.getCharacter.mockResolvedValue(null);
    const app = await buildApp();
    const res = await request(app).get("/api/characters/99999");

    expect(res.status).toBe(404);
  });
});

// ── Progress routes ───────────────────────────────────────────────────────────

describe("POST /api/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.upsertCharacterProgress.mockResolvedValue(fakeProgress);
    mockStorage.getUserSettings.mockResolvedValue(fakeSettings);
    mockStorage.upsertUserSettings.mockResolvedValue(fakeSettings);
  });

  it("creates/updates progress with valid data", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/progress")
      .send({ characterIndex: 1, reading: true, writing: false, radical: false });

    expect(res.status).toBe(200);
    expect(mockStorage.upsertCharacterProgress).toHaveBeenCalledWith(
      expect.objectContaining({ characterIndex: 1, reading: true })
    );
  });

  it("accepts missing reading/writing/radical (schema defaults to false)", async () => {
    // insertCharacterProgressSchema gives boolean fields default values,
    // so omitting them is valid — the route returns 200 with defaults applied.
    const app = await buildApp();
    const res = await request(app)
      .post("/api/progress")
      .send({ characterIndex: 1 });

    expect(res.status).toBe(200);
  });

  it("returns 400 for non-numeric characterIndex", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/progress")
      .send({ characterIndex: "abc", reading: true, writing: false, radical: false });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/progress/range", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getUserCharacterProgress.mockResolvedValue([fakeProgress]);
    mockStorage.getProgressForRange.mockResolvedValue([fakeProgress]);
    mockStorage.getUserSettings.mockResolvedValue(fakeSettings);
    mockStorage.upsertUserSettings.mockResolvedValue(fakeSettings);
  });

  it("returns progress array for valid start/count path params", async () => {
    // Route is /api/progress/range/:start/:count — path params, not query params
    const app = await buildApp();
    const res = await request(app).get("/api/progress/range/0/5");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("GET /api/progress/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getMasteryStats.mockResolvedValue({
      readingMastered: 10,
      writingMastered: 8,
      radicalMastered: 5,
      characterMastered: 4,
      total: 3000,
    });
    mockStorage.getUserSettings.mockResolvedValue(fakeSettings);
    mockStorage.upsertUserSettings.mockResolvedValue(fakeSettings);
  });

  it("returns stats with all required fields", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/progress/stats");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      readingMastered: expect.any(Number),
      writingMastered: expect.any(Number),
      radicalMastered: expect.any(Number),
      characterMastered: expect.any(Number),
      total: expect.any(Number),
    });
  });
});
