import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ChevronRight, BookOpen, SkipForward } from "lucide-react";
import QuizShell from "./QuizShell";
import { HSK_COLORS, EMPTY_SCORES, type QuizScores, type WrongAnswer } from "./quizTypes";

interface WordQuestion {
  wordId: number;
  word: string;
  traditional: string;
  pinyin: string;
  definition: string[];
  hskLevel: number;
  sentence: string | null;
  blanked: string | null;
  translation: string | null;
}

interface CheckResult {
  correct: boolean;
  feedback: string;
}

async function fetchWordQuestion(levels: number[], excludeIds: number[]): Promise<WordQuestion> {
  const excludeParam = excludeIds.length > 0 ? `&exclude=${excludeIds.join(",")}` : "";
  const res = await fetch(`/api/quiz/word?levels=${levels.join(",")}${excludeParam}`);
  if (!res.ok) throw new Error("Failed to load word question");
  return res.json();
}

async function checkWordAnswer(payload: {
  wordId: number;
  blanked: string;
  userAnswer: string;
  correctWord: string;
  pinyin: string;
  definition: string[];
}): Promise<CheckResult> {
  const res = await fetch("/api/quiz/word/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to check answer");
  return res.json();
}

async function saveWordProgress(wordId: number, known: boolean): Promise<void> {
  try {
    await fetch(`/api/progress/words/${wordId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ known }),
    });
  } catch {
    // best-effort
  }
}

export default function WordQuiz() {
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2, 3]);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [scores, setScores] = useState<QuizScores>({ ...EMPTY_SCORES, byLevel: {} });
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const seenIds = useRef<number[]>([]);
  const autoRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: question, isLoading, isError, refetch } = useQuery({
    queryKey: ["quiz-word", selectedLevels],
    queryFn: () => fetchWordQuestion(selectedLevels, seenIds.current),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: 1000,
  });

  useEffect(() => {
    if (question) {
      seenIds.current = [
        ...seenIds.current.filter((i) => i !== question.wordId),
        question.wordId,
      ].slice(-50);
    }
  }, [question?.wordId]);

  useEffect(() => {
    if (isError) {
      autoRetryTimer.current = setTimeout(() => refetch(), 3000);
    }
    return () => {
      if (autoRetryTimer.current) clearTimeout(autoRetryTimer.current);
    };
  }, [isError]);

  const checkMutation = useMutation({
    mutationFn: checkWordAnswer,
    onSuccess: (data, vars) => {
      setResult(data);
      const lvl = question?.hskLevel ?? 1;
      setScores((s) => {
        const prev = s.byLevel[lvl] ?? { correct: 0, total: 0 };
        return {
          correct: s.correct + (data.correct ? 1 : 0),
          wrong: s.wrong + (data.correct ? 0 : 1),
          streak: data.correct ? s.streak + 1 : 0,
          skipped: s.skipped,
          byLevel: {
            ...s.byLevel,
            [lvl]: { correct: prev.correct + (data.correct ? 1 : 0), total: prev.total + 1 },
          },
        };
      });
      if (question) {
        saveWordProgress(question.wordId, data.correct);
        if (!data.correct) {
          setWrongAnswers((w) => [...w, {
            character: question.word,
            traditional: question.traditional,
            pinyin: question.pinyin,
            userAnswer: vars.userAnswer,
            sentence: question.sentence ?? "",
            blanked: question.blanked ?? "",
            translation: question.translation ?? "",
            hskLevel: question.hskLevel,
            mode: "fill" as const,
          }]);
        }
      }
    },
  });

  function toggleLevel(level: number) {
    seenIds.current = [];
    setSelectedLevels((prev) => {
      if (prev.includes(level)) {
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== level);
      }
      return [...prev, level].sort();
    });
  }

  function handleSubmit() {
    if (!question || !answer.trim() || checkMutation.isPending) return;
    checkMutation.mutate({
      wordId: question.wordId,
      blanked: question.blanked ?? "",
      userAnswer: answer.trim(),
      correctWord: question.word,
      pinyin: question.pinyin,
      definition: question.definition,
    });
  }

  const handleNext = useCallback(() => {
    setAnswer("");
    setResult(null);
    refetch();
  }, [refetch]);

  function handleSkip() {
    setScores((s) => ({ ...s, skipped: s.skipped + 1, streak: 0 }));
    setAnswer("");
    setResult(null);
    refetch();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.isComposing) return;
      if ((e.key === "n" || e.key === "N") && result) { handleNext(); return; }
      if ((e.key === "s" || e.key === "S") && !result && document.activeElement?.tagName !== "INPUT") {
        handleSkip();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [result, handleNext]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.isComposing) return;
    if (e.key === "Enter") {
      if (result) handleNext();
      else handleSubmit();
    }
  }

  function renderBlanked(q: WordQuestion) {
    if (!q.blanked) return null;
    // blanked may use ＿＿ (two fullwidth underscores) for multi-char words
    const parts = q.blanked.split(/＿+/);
    const blankWidth = Math.max(2, q.word.length) * 1.5;
    return (
      <span>
        {parts[0]}
        <span
          className="inline-block border-b-2 border-red-500 mx-1 text-center text-red-500 font-bold"
          style={{ minWidth: `${blankWidth}rem` }}
        >
          {result ? q.word : "　".repeat(q.word.length)}
        </span>
        {parts[1]}
      </span>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 space-y-6">
      <QuizShell
        scores={scores}
        selectedLevels={selectedLevels}
        onToggleLevel={(level) => { toggleLevel(level); setResult(null); setAnswer(""); }}
        wrongAnswers={wrongAnswers}
      />

      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="p-6 border-b space-y-4">
          {isLoading && <div className="text-center text-muted-foreground py-8 text-sm">Loading question…</div>}
          {isError && (
            <div className="text-center text-destructive py-8 text-sm">
              Failed to load question. Retrying…{" "}
              <button onClick={() => refetch()} className="underline">Retry now</button>
            </div>
          )}
          {question && !isLoading && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${HSK_COLORS[question.hskLevel]}`}>
                  HSK {question.hskLevel}
                </span>
                <span className="text-xs text-muted-foreground">{question.pinyin}</span>
                {/* Show the word/traditional only after the user has answered */}
                {result && question.traditional && question.traditional !== question.word && (
                  <span className="text-xs text-muted-foreground font-serif">{question.traditional}</span>
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                {question.definition.slice(0, 3).join(" · ")}
              </div>

              {question.blanked ? (
                <div className="font-serif text-2xl leading-relaxed tracking-wide">
                  {renderBlanked(question)}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic">Type the word above in simplified Chinese characters.</div>
              )}

              {result && question.translation && (
                <div className="text-sm text-muted-foreground italic">"{question.translation}"</div>
              )}
            </>
          )}
        </div>

        {question && !isLoading && (
          <div className="p-4 flex items-center gap-3">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!!result}
              maxLength={6}
              placeholder={question.word.length <= 2 ? "__" : "___"}
              className={`w-32 text-center text-2xl font-serif border rounded-lg p-2 outline-none transition-colors
                ${result?.correct === true  ? "border-green-500 bg-green-50 text-green-700" : ""}
                ${result?.correct === false ? "border-red-500 bg-red-50 text-red-700" : ""}
                ${!result ? "border-border focus:border-foreground bg-background" : ""}
              `}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
            <div className="flex-1" />
            {!result ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="gap-1 text-muted-foreground"
                >
                  <SkipForward className="w-4 h-4" /> Skip
                  <span className="text-[10px] font-mono opacity-50 ml-0.5">[S]</span>
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!answer.trim() || checkMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {checkMutation.isPending ? "Checking…" : "Check"}
                </Button>
              </>
            ) : (
              <Button onClick={handleNext} variant="outline" className="gap-1">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {result && (
        <div className={`rounded-xl border p-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200
          ${result.correct ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {result.correct
              ? <><CheckCircle className="w-4 h-4" /> Correct!</>
              : <><XCircle className="w-4 h-4" /> Not quite — the answer is{" "}
                  <span className="font-serif text-lg">{question?.word}</span>
                  {question?.traditional && question.traditional !== question.word &&
                    <span className="font-serif text-lg"> ({question.traditional})</span>
                  }
                </>
            }
          </div>
          <p className="text-sm leading-relaxed opacity-90">{result.feedback}</p>
        </div>
      )}

      {!isLoading && !isError && !question && (
        <div className="text-center text-muted-foreground flex flex-col items-center gap-2 py-8">
          <BookOpen className="w-8 h-8 opacity-30" />
          <p className="text-sm">Select at least one HSK level to begin</p>
        </div>
      )}
    </div>
  );
}
