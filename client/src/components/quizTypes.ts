// Shared types for all quiz modes

export interface QuizQuestion {
  characterIndex: number;
  character: string;
  traditional: string;
  traditionalVariants: string[] | null;
  pinyin: string;
  pinyin2: string | null;
  definition: string[];
  hskLevel: number;
  sentence: string;
  blanked: string;
  translation: string;
}

export interface WrongAnswer {
  character: string;
  traditional: string;
  pinyin: string;
  userAnswer: string;
  sentence: string;
  blanked: string;
  translation: string;
  hskLevel: number;
  mode: "choice" | "fill" | "write";
}

export interface LevelStats {
  correct: number;
  total: number;
}

export interface QuizScores {
  correct: number;
  wrong: number;
  streak: number;
  skipped: number;
  byLevel: Record<number, LevelStats>;
}

export const EMPTY_SCORES: QuizScores = {
  correct: 0,
  wrong: 0,
  streak: 0,
  skipped: 0,
  byLevel: {},
};

export const HSK_COLORS: Record<number, string> = {
  0: "bg-gray-100 text-gray-500 border-gray-200",
  1: "bg-red-100 text-red-700 border-red-200",
  2: "bg-orange-100 text-orange-700 border-orange-200",
  3: "bg-yellow-100 text-yellow-700 border-yellow-200",
  4: "bg-green-100 text-green-700 border-green-200",
  5: "bg-blue-100 text-blue-700 border-blue-200",
  6: "bg-purple-100 text-purple-700 border-purple-200",
  7: "bg-pink-100 text-pink-700 border-pink-200",
  8: "bg-rose-100 text-rose-700 border-rose-200",
  9: "bg-gray-100 text-gray-700 border-gray-200",
};

export const HSK_BG_SOLID: Record<number, string> = {
  0: "bg-gray-400",
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-yellow-500",
  4: "bg-green-500",
  5: "bg-blue-500",
  6: "bg-purple-500",
  7: "bg-pink-500",
  8: "bg-rose-500",
  9: "bg-gray-500",
};

export const ALL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Hint rules matching real HSK exam conventions:
// HSK 1 → pinyin + definition, HSK 2 → pinyin only, HSK 3-6 → no hint
export function getHint(q: QuizQuestion): { pinyin: boolean; definition: boolean } {
  return {
    pinyin: q.hskLevel <= 2,
    definition: q.hskLevel === 1,
  };
}

// Save progress to the existing /api/progress endpoint
export async function saveProgress(
  characterIndex: number,
  field: "reading" | "writing"
): Promise<void> {
  try {
    await fetch(`/api/progress/${characterIndex}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: true }),
    });
  } catch {
    // Non-fatal — progress saving is best-effort
  }
}

// Fetch a question from the API; pass excludeIndices to avoid recently-seen repeats
export async function fetchQuestion(levels: number[], excludeIndices: number[] = []): Promise<QuizQuestion> {
  const excludeParam = excludeIndices.length > 0 ? `&exclude=${excludeIndices.join(",")}` : "";
  const res = await fetch(`/api/quiz/question?levels=${levels.join(",")}${excludeParam}`);
  if (!res.ok) throw new Error("Failed to load question");
  return res.json();
}

// Fire-and-forget prefetch to warm the feedback cache for a question
export function prefetchFeedback(q: QuizQuestion): void {
  fetch("/api/quiz/prefetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      character: q.character,
      blanked: q.blanked,
      translation: q.translation,
      definition: q.definition,
      pinyin: q.pinyin,
      hskLevel: q.hskLevel,
    }),
  }).catch(() => {});
}
