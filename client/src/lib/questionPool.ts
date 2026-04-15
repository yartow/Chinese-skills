/**
 * In-memory question pools for brief connectivity drops (tunnels, weak signal).
 *
 * Keeps POOL_TARGET questions pre-fetched per quiz type + level combination.
 * When the pool drops below REFILL_AT, a background fetch tops it up.
 * All active pools are also refilled automatically when the browser goes back online.
 *
 * Usage:
 *   // In a quiz queryFn:
 *   queryFn: () => drawStdQuestion(levels, seenIndices.current) ?? fetchQuestion(levels, seenIndices.current)
 */

import type { QuizQuestion } from "../components/quizTypes";

const POOL_TARGET = 10;
const REFILL_AT = 3;

// ── Standard quiz pool (fill-in-blank, multiple choice, handwriting) ──────────

interface StdPool {
  questions: QuizQuestion[];
  filling: boolean;
}

const stdPools = new Map<string, StdPool>();

function stdKey(levels: number[]) {
  return [...levels].sort().join(",");
}

function getStdPool(levels: number[]): StdPool {
  const k = stdKey(levels);
  if (!stdPools.has(k)) stdPools.set(k, { questions: [], filling: false });
  return stdPools.get(k)!;
}

async function fillStdPool(levels: number[]) {
  if (!navigator.onLine) return;
  const p = getStdPool(levels);
  if (p.filling) return;
  const needed = POOL_TARGET - p.questions.length;
  if (needed <= 0) return;
  p.filling = true;
  const exclude = p.questions.map((q) => q.characterIndex);
  const excludeParam = exclude.length ? `&exclude=${exclude.join(",")}` : "";
  const fetches = Array.from({ length: needed }, () =>
    fetch(`/api/quiz/question?levels=${levels.join(",")}${excludeParam}`)
      .then((r) => (r.ok ? (r.json() as Promise<QuizQuestion>) : Promise.reject()))
      .catch(() => null)
  );
  const results = await Promise.allSettled(fetches);
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) p.questions.push(r.value);
  }
  p.filling = false;
}

/**
 * Draw a question from the pool, skipping any already-seen indices.
 * Returns null if the pool is empty (caller should fall back to network fetch).
 * Triggers a background refill when pool is running low.
 */
export function drawStdQuestion(
  levels: number[],
  excludeIndices: number[]
): QuizQuestion | null {
  const p = getStdPool(levels);
  const idx = p.questions.findIndex(
    (q) => !excludeIndices.includes(q.characterIndex)
  );
  if (idx === -1) return null;
  const [q] = p.questions.splice(idx, 1);
  if (p.questions.length < REFILL_AT) fillStdPool(levels);
  return q;
}

/** Seed the pool eagerly, e.g. on component mount while online. */
export function warmUpStdPool(levels: number[]) {
  fillStdPool(levels);
}

// ── Word quiz pool ─────────────────────────────────────────────────────────────

// Use a loose shape so we avoid importing WordQuestion from WordQuiz.tsx
interface WordQuestionLike {
  wordId: number;
  [key: string]: unknown;
}

interface WordPool {
  questions: WordQuestionLike[];
  filling: boolean;
}

const wordPools = new Map<string, WordPool>();

function getWordPool(levels: number[]): WordPool {
  const k = stdKey(levels);
  if (!wordPools.has(k)) wordPools.set(k, { questions: [], filling: false });
  return wordPools.get(k)!;
}

async function fillWordPool(levels: number[]) {
  if (!navigator.onLine) return;
  const p = getWordPool(levels);
  if (p.filling) return;
  const needed = POOL_TARGET - p.questions.length;
  if (needed <= 0) return;
  p.filling = true;
  const exclude = p.questions.map((q) => q.wordId as number);
  const excludeParam = exclude.length ? `&exclude=${exclude.join(",")}` : "";
  const fetches = Array.from({ length: needed }, () =>
    fetch(`/api/quiz/word?levels=${levels.join(",")}${excludeParam}`)
      .then((r) =>
        r.ok ? (r.json() as Promise<WordQuestionLike>) : Promise.reject()
      )
      .catch(() => null)
  );
  const results = await Promise.allSettled(fetches);
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) p.questions.push(r.value);
  }
  p.filling = false;
}

export function drawWordQuestion(
  levels: number[],
  excludeIds: number[]
): WordQuestionLike | null {
  const p = getWordPool(levels);
  const idx = p.questions.findIndex((q) => !excludeIds.includes(q.wordId as number));
  if (idx === -1) return null;
  const [q] = p.questions.splice(idx, 1);
  if (p.questions.length < REFILL_AT) fillWordPool(levels);
  return q;
}

export function warmUpWordPool(levels: number[]) {
  fillWordPool(levels);
}

// ── Auto-refill on reconnect ───────────────────────────────────────────────────

window.addEventListener("online", () => {
  stdPools.forEach((_, k) => fillStdPool(k.split(",").map(Number)));
  wordPools.forEach((_, k) => fillWordPool(k.split(",").map(Number)));
});
