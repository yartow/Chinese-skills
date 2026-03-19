import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ChevronRight, BookOpen } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuizQuestion {
  characterIndex: number;
  character: string;
  traditional: string;
  pinyin: string;
  pinyin2: string | null;
  definition: string[];
  hskLevel: number;
  sentence: string;
  blanked: string;
  translation: string;
}

interface CheckResult {
  correct: boolean;
  correctAnswer: string;
  fullSentence: string;
  feedback: string;
}

// ── HSK level colours (matches your existing app's red theme) ─────────────────

const HSK_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-700 border-red-200",
  2: "bg-orange-100 text-orange-700 border-orange-200",
  3: "bg-yellow-100 text-yellow-700 border-yellow-200",
  4: "bg-green-100 text-green-700 border-green-200",
  5: "bg-blue-100 text-blue-700 border-blue-200",
  6: "bg-purple-100 text-purple-700 border-purple-200",
};

const ALL_LEVELS = [1, 2, 3, 4, 5, 6];

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchQuestion(levels: number[]): Promise<QuizQuestion> {
  const res = await fetch(`/api/quiz/question?levels=${levels.join(",")}`);
  if (!res.ok) throw new Error("Failed to load question");
  return res.json();
}

async function checkAnswer(payload: {
  character: string;
  answer: string;
  blanked: string;
  translation: string;
  definition: string[];
  pinyin: string;
  hskLevel: number;
}): Promise<CheckResult> {
  const res = await fetch("/api/quiz/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to check answer");
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FillInBlankQuiz() {
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2, 3]);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [scores, setScores] = useState({ correct: 0, wrong: 0, streak: 0 });

  // ── Fetch question ──
  const {
    data: question,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["quiz-question", selectedLevels],
    queryFn: () => fetchQuestion(selectedLevels),
    // Don't auto-refetch — only when user clicks Next
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // ── Check answer ──
  const checkMutation = useMutation({
    mutationFn: checkAnswer,
    onSuccess: (data) => {
      setResult(data);
      setScores((s) => ({
        correct: s.correct + (data.correct ? 1 : 0),
        wrong: s.wrong + (data.correct ? 0 : 1),
        streak: data.correct ? s.streak + 1 : 0,
      }));
    },
  });

  // ── Handlers ──
  function toggleLevel(level: number) {
    setSelectedLevels((prev) => {
      if (prev.includes(level)) {
        // Don't allow deselecting all
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== level);
      }
      return [...prev, level].sort();
    });
  }

  function handleSubmit() {
    if (!question || !answer.trim()) return;
    checkMutation.mutate({
      character: question.character,
      answer: answer.trim(),
      blanked: question.blanked,
      translation: question.translation,
      definition: question.definition,
      pinyin: question.pinyin,
      hskLevel: question.hskLevel,
    });
  }

  function handleNext() {
    setAnswer("");
    setResult(null);
    refetch();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (result) handleNext();
      else handleSubmit();
    }
  }

  // ── Render blanked sentence with styled blank ──
  function renderBlanked(blanked: string) {
    const parts = blanked.split("＿");
    return (
      <span>
        {parts[0]}
        <span className="inline-block border-b-2 border-red-500 w-10 mx-1 text-center text-red-500 font-bold">
          {result ? result.correctAnswer : "＿"}
        </span>
        {parts[1]}
      </span>
    );
  }

  // ── UI ──
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">

      {/* Score bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Correct", value: scores.correct, color: "text-green-600" },
          { label: "Wrong",   value: scores.wrong,   color: "text-red-600" },
          { label: "Streak",  value: scores.streak,  color: "text-orange-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-muted rounded-lg p-3 text-center">
            <div className={`text-2xl font-semibold ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Level selector */}
      <div className="flex flex-wrap gap-2">
        {ALL_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => { toggleLevel(level); setResult(null); setAnswer(""); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all
              ${selectedLevels.includes(level)
                ? HSK_COLORS[level] + " border-current"
                : "bg-background text-muted-foreground border-border hover:border-foreground"
              }`}
          >
            HSK {level}
          </button>
        ))}
      </div>

      {/* Question card */}
      <div className="border rounded-xl overflow-hidden bg-card">

        {/* Card top */}
        <div className="p-6 border-b space-y-4">
          {isLoading && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Loading question…
            </div>
          )}
          {isError && (
            <div className="text-center text-destructive py-8 text-sm">
              Failed to load question.{" "}
              <button onClick={() => refetch()} className="underline">Try again</button>
            </div>
          )}
          {question && !isLoading && (
            <>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${HSK_COLORS[question.hskLevel]}`}>
                  HSK {question.hskLevel}
                </span>
                {question.pinyin2 && (
                  <span className="text-xs text-muted-foreground">
                    多音字: {question.pinyin} / {question.pinyin2}
                  </span>
                )}
              </div>

              {/* Sentence */}
              <div className="font-serif text-3xl leading-relaxed tracking-wide">
                {renderBlanked(question.blanked)}
              </div>

              {/* Translation — only shown after submitting to avoid spoilers */}
              {result && (
                <div className="text-sm text-muted-foreground italic">
                  "{question.translation}"
                </div>
              )}

              {/* Hint — show pinyin for HSK 1-2, hide for 3+ */}
              {question.hskLevel <= 2 && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{question.pinyin}</span>
                  {" · "}
                  {question.definition[0]}
                </div>
              )}
            </>
          )}
        </div>

        {/* Card bottom — input */}
        {question && !isLoading && (
          <div className="p-4 flex items-center gap-3">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!!result}
              placeholder="Type character…"
              maxLength={2}
              className={`w-24 text-center text-2xl font-serif border rounded-lg p-2 outline-none transition-colors
                ${result?.correct === true  ? "border-green-500 bg-green-50 text-green-700" : ""}
                ${result?.correct === false ? "border-red-500 bg-red-50 text-red-700"     : ""}
                ${!result ? "border-border focus:border-foreground bg-background" : ""}
              `}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />

            <div className="flex-1 text-sm text-muted-foreground">
              {!result && question.hskLevel >= 3 && "Enter the missing character"}
            </div>

            {!result ? (
              <Button
                onClick={handleSubmit}
                disabled={!answer.trim() || checkMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {checkMutation.isPending ? "Checking…" : "Check"}
              </Button>
            ) : (
              <Button onClick={handleNext} variant="outline" className="gap-1">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Feedback panel */}
      {result && (
        <div className={`rounded-xl border p-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200
          ${result.correct
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {result.correct
              ? <><CheckCircle className="w-4 h-4" /> Correct!</>
              : <><XCircle className="w-4 h-4" /> Not quite — the answer is <span className="font-serif text-lg">{result.correctAnswer}</span></>
            }
          </div>
          <p className="text-sm leading-relaxed opacity-90">{result.feedback}</p>
          {!result.correct && (
            <p className="text-sm font-serif opacity-75">{result.fullSentence}</p>
          )}
        </div>
      )}

      {/* Empty state nudge */}
      {!isLoading && !isError && !question && (
        <div className="text-center text-muted-foreground flex flex-col items-center gap-2 py-8">
          <BookOpen className="w-8 h-8 opacity-30" />
          <p className="text-sm">Select at least one HSK level to begin</p>
        </div>
      )}
    </div>
  );
}
