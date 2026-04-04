import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SkipForward, Eraser, Settings2 } from "lucide-react";
import { ALL_LEVELS, HSK_COLORS } from "./quizTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuizQuestion {
  characterIndex: number;
  character: string;
  pinyin: string;
  pinyin2: string | null;
  definition: string[];
  hskLevel: number;
  blanked: string;
  translation: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchQuestion(levels: number[], excludeIndices: number[]): Promise<QuizQuestion> {
  const excludeParam = excludeIndices.length > 0 ? `&exclude=${excludeIndices.join(",")}` : "";
  const res = await fetch(`/api/quiz/question?levels=${levels.join(",")}${excludeParam}`);
  if (!res.ok) throw new Error("Failed to load question");
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StrokeOrderQuiz() {
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2, 3]);
  const [scores, setScores] = useState({ correct: 0, wrong: 0, streak: 0, skipped: 0 });
  const [leniency, setLeniency] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [mistakesThisQuestion, setMistakesThisQuestion] = useState(0);

  const seenIndices = useRef<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<any>(null);
  const autoRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: question,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["hw-quiz-question", selectedLevels],
    queryFn: () => fetchQuestion(selectedLevels, seenIndices.current),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: 1000,
  });

  // Auto-retry on persistent error
  useEffect(() => {
    if (isError) {
      autoRetryTimer.current = setTimeout(() => refetch(), 3000);
    }
    return () => {
      if (autoRetryTimer.current) clearTimeout(autoRetryTimer.current);
    };
  }, [isError]);

  // Track seen indices
  useEffect(() => {
    if (question) {
      seenIndices.current = [
        ...seenIndices.current.filter((i) => i !== question.characterIndex),
        question.characterIndex,
      ].slice(-50);
    }
  }, [question?.characterIndex]);

  // Init hanzi-writer quiz when question changes
  useEffect(() => {
    if (!question || !containerRef.current) return;

    setCompleted(false);
    setMistakesThisQuestion(0);

    import("hanzi-writer").then((HanziWriter) => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = "";

      writerRef.current = HanziWriter.default.create(containerRef.current, question.character, {
        width: 260,
        height: 260,
        padding: 10,
        showOutline: true,
        strokeColor: "#1a1a1a",
        outlineColor: "#e5e7eb",
        highlightColor: "#ef4444",
        drawingColor: "#3b82f6",
        drawingWidth: 6,
        leniency,
        showHintAfterMisses: 3,
        highlightOnComplete: true,
        onMistake: () => setMistakesThisQuestion((m) => m + 1),
        onComplete: () => setCompleted(true),
      });

      writerRef.current.quiz();
    });
  }, [question?.characterIndex]);

  // Advance automatically when completed
  useEffect(() => {
    if (!completed) return;
    const t = setTimeout(() => handleNext(true), 1200);
    return () => clearTimeout(t);
  }, [completed]);

  function handleNext(wasCorrect: boolean) {
    setCompleted(false);
    setMistakesThisQuestion(0);
    if (wasCorrect) {
      setScores((s) => ({ ...s, correct: s.correct + 1, streak: s.streak + 1 }));
    }
    refetch();
  }

  function handleSkip() {
    setScores((s) => ({ ...s, skipped: s.skipped + 1, streak: 0 }));
    setCompleted(false);
    setMistakesThisQuestion(0);
    refetch();
  }

  function handleErase() {
    if (!writerRef.current || !containerRef.current || !question) return;
    containerRef.current.innerHTML = "";
    import("hanzi-writer").then((HanziWriter) => {
      if (!containerRef.current) return;
      writerRef.current = HanziWriter.default.create(containerRef.current, question.character, {
        width: 260,
        height: 260,
        padding: 10,
        showOutline: true,
        strokeColor: "#1a1a1a",
        outlineColor: "#e5e7eb",
        highlightColor: "#ef4444",
        drawingColor: "#3b82f6",
        drawingWidth: 6,
        leniency,
        showHintAfterMisses: 3,
        highlightOnComplete: true,
        onMistake: () => setMistakesThisQuestion((m) => m + 1),
        onComplete: () => setCompleted(true),
      });
      writerRef.current.quiz();
    });
  }

  function toggleLevel(level: number) {
    seenIndices.current = [];
    setSelectedLevels((prev) => {
      if (prev.includes(level)) {
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== level);
      }
      return [...prev, level].sort();
    });
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">

      {/* Score bar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Correct", value: scores.correct, color: "text-green-600" },
          { label: "Wrong",   value: scores.wrong,   color: "text-red-600" },
          { label: "Streak",  value: scores.streak,  color: "text-orange-500" },
          { label: "Skipped", value: scores.skipped, color: "text-blue-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-muted rounded-lg p-3 text-center">
            <div className={`text-2xl font-semibold ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Level selector */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {ALL_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                ${selectedLevels.includes(level)
                  ? HSK_COLORS[level] + " border-current"
                  : "bg-background text-muted-foreground border-border hover:border-foreground"
                }`}
            >
              {level === 0 ? "Unknown" : `HSK ${level}`}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title="Sensitivity settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Sensitivity settings */}
      {showSettings && (
        <div className="border rounded-xl p-4 space-y-3 bg-muted/40">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Stroke leniency</span>
            <span className="text-sm text-muted-foreground">
              {leniency < 0.8 ? "Strict" : leniency < 1.3 ? "Normal" : "Lenient"}
            </span>
          </div>
          <Slider
            min={0.3}
            max={2.0}
            step={0.1}
            value={[leniency]}
            onValueChange={([v]) => setLeniency(v)}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Controls how precisely you need to draw each stroke. Takes effect from the next question.
            Hints appear after 3 mistakes regardless of this setting.
          </p>
        </div>
      )}

      {/* Question card */}
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="p-6 border-b space-y-3">
          {isLoading && (
            <div className="text-center text-muted-foreground py-8 text-sm">Loading question…</div>
          )}
          {isError && (
            <div className="text-center text-destructive py-8 text-sm">
              Failed to load question. Retrying…{" "}
              <button onClick={() => refetch()} className="underline">Retry now</button>
            </div>
          )}
          {question && !isLoading && (
            <>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${HSK_COLORS[question.hskLevel] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
                  {question.hskLevel === 0 ? "Unknown" : `HSK ${question.hskLevel}`}
                </span>
              </div>
              <div className="font-serif text-3xl leading-relaxed tracking-wide">
                {question.blanked.split("＿").map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span className="inline-block border-b-2 border-red-500 w-8 mx-1" />
                    )}
                  </span>
                ))}
              </div>
              <div className="text-sm text-muted-foreground italic">"{question.translation}"</div>
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

        {/* Drawing area */}
        {question && !isLoading && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Trace each stroke in order</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSkip} className="gap-1">
                  <SkipForward className="w-3.5 h-3.5" /> Skip
                </Button>
                <Button variant="outline" size="sm" onClick={handleErase} className="gap-1">
                  <Eraser className="w-3.5 h-3.5" /> Erase
                </Button>
              </div>
            </div>

            {completed && (
              <div className="text-center text-green-600 text-sm font-medium animate-in fade-in duration-200">
                Correct! Loading next…
              </div>
            )}

            <div className="flex justify-center">
              <div
                ref={containerRef}
                className="border-2 border-dashed border-muted-foreground/30 rounded-xl bg-white"
                style={{ width: 260, height: 260 }}
              />
            </div>

            {mistakesThisQuestion > 0 && !completed && (
              <p className="text-center text-xs text-muted-foreground">
                {mistakesThisQuestion} mistake{mistakesThisQuestion !== 1 ? "s" : ""} so far
                {mistakesThisQuestion >= 3 ? " — a hint stroke will appear" : ""}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
