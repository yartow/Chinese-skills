import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ChevronRight, BookOpen, SkipForward } from "lucide-react";
import QuizShell from "./QuizShell";
import {
  HSK_COLORS, EMPTY_SCORES, getHint, saveProgress, fetchQuestion, prefetchFeedback,
  type QuizQuestion, type WrongAnswer, type QuizScores,
} from "./quizTypes";

interface CheckResult {
  correct: boolean;
  correctAnswer: string;
  fullSentence: string;
  feedback: string;
}

// Mutation vars include a question snapshot so onSuccess is never stale
interface CheckPayload {
  character: string;
  answer: string;
  blanked: string;
  translation: string;
  definition: string[];
  pinyin: string;
  hskLevel: number;
  // snapshot fields — not sent to server
  characterIndex: number;
  traditional: string;
  sentence: string;
}

async function checkAnswer(payload: Omit<CheckPayload, "characterIndex" | "traditional" | "sentence">): Promise<CheckResult> {
  const res = await fetch("/api/quiz/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to check answer");
  return res.json();
}

export default function FillInBlankQuiz() {
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2, 3]);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [scores, setScores] = useState<QuizScores>({ ...EMPTY_SCORES, byLevel: {} });
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);

  const { data: question, isLoading, isError, refetch } = useQuery({
    queryKey: ["quiz-fill", selectedLevels],
    queryFn: () => fetchQuestion(selectedLevels),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Pre-warm the feedback cache as soon as the question loads
  useEffect(() => {
    if (question) prefetchFeedback(question);
  }, [question?.blanked, question?.character]);

  const checkMutation = useMutation({
    mutationFn: ({ characterIndex, traditional, sentence, ...apiPayload }: CheckPayload) =>
      checkAnswer(apiPayload),
    onSuccess: (data, vars) => {
      setResult(data);
      const lvl = vars.hskLevel;
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
      if (data.correct) {
        saveProgress(vars.characterIndex, "reading");
      } else {
        setWrongAnswers((w) => [...w, {
          character: vars.character,
          traditional: vars.traditional,
          pinyin: vars.pinyin,
          userAnswer: vars.answer,
          sentence: vars.sentence,
          blanked: vars.blanked,
          translation: vars.translation,
          hskLevel: vars.hskLevel,
          mode: "fill" as const,
        }]);
      }
    },
  });

  function toggleLevel(level: number) {
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
      character: question.character,
      answer: answer.trim(),
      blanked: question.blanked,
      translation: question.translation,
      definition: question.definition,
      pinyin: question.pinyin,
      hskLevel: question.hskLevel,
      characterIndex: question.characterIndex,
      traditional: question.traditional,
      sentence: question.sentence,
    });
  }

  function handleNext() {
    setAnswer("");
    setResult(null);
    refetch();
  }

  function handleSkip() {
    setScores((s) => ({ ...s, skipped: s.skipped + 1, streak: 0 }));
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

  // N key = next question (only after answering, not while typing in an active input)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "n" || e.key === "N") && result) {
        const el = document.activeElement as HTMLInputElement | null;
        if (el?.tagName === "INPUT" && !el.disabled) return;
        handleNext();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [result]);

  function renderBlanked(q: QuizQuestion) {
    const parts = q.blanked.split("＿");
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

  const hint = question ? getHint(question) : null;

  return (
    <div className="space-y-6">
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
              Failed to load.{" "}
              <button onClick={() => refetch()} className="underline">Try again</button>
            </div>
          )}
          {question && !isLoading && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${HSK_COLORS[question.hskLevel]}`}>
                  HSK {question.hskLevel}
                </span>
                {question.pinyin2 && (
                  <span className="text-xs text-muted-foreground">
                    多音字: {question.pinyin} / {question.pinyin2}
                  </span>
                )}
              </div>

              <div className="font-serif text-3xl leading-relaxed tracking-wide">
                {renderBlanked(question)}
              </div>

              {result && (
                <div className="text-sm text-muted-foreground italic">"{question.translation}"</div>
              )}

              {hint && (hint.pinyin || hint.definition) && (
                <div className="text-sm text-muted-foreground">
                  {hint.pinyin && <span className="font-medium text-foreground">{question.pinyin}</span>}
                  {hint.definition && <span> · {question.definition[0]}</span>}
                </div>
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
              maxLength={2}
              className={`w-24 text-center text-2xl font-serif border rounded-lg p-2 outline-none transition-colors
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
                  <span className="font-serif text-lg">{result.correctAnswer}</span></>
            }
          </div>
          <p className="text-sm leading-relaxed opacity-90">{result.feedback}</p>
          {!result.correct && (
            <p className="text-sm font-serif opacity-75">{result.fullSentence}</p>
          )}
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
