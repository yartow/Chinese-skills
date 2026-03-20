import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ChevronRight, BookOpen } from "lucide-react";
import QuizShell from "./QuizShell";
import {
  HSK_COLORS, EMPTY_SCORES, getHint, saveProgress, fetchQuestion,
  type QuizQuestion, type WrongAnswer, type QuizScores,
} from "./quizTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Choice {
  character: string;
  traditional: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchChoices(
  correctIndex: number,
  hskLevel: number,
  levels: number[]
): Promise<Choice[]> {
  const res = await fetch(
    `/api/quiz/choices?correctIndex=${correctIndex}&hskLevel=${hskLevel}&levels=${levels.join(",")}`
  );
  if (!res.ok) throw new Error("Failed to load choices");
  return res.json();
}

// Shuffle array in place
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MultipleChoiceQuiz() {
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2, 3]);
  const [scores, setScores] = useState<QuizScores>({ ...EMPTY_SCORES, byLevel: {} });
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);

  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  // ── Load question + choices together ──
  async function loadQuestion(levels: number[]) {
    setIsLoading(true);
    setIsError(false);
    setSelected(null);
    setChoices([]);
    setQuestion(null);
    try {
      const q = await fetchQuestion(levels);
      const distractors = await fetchChoices(q.characterIndex, q.hskLevel, levels);
      const correct: Choice = { character: q.character, traditional: q.traditional };
      setChoices(shuffle([correct, ...distractors]).slice(0, 4));
      setQuestion(q);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadQuestion(selectedLevels); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "n" || e.key === "N") {
        // Only if not typing in an input field
        if (document.activeElement?.tagName === "INPUT") return;
        handleNext();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [result]); // re-register when result changes so handleNext has fresh state

  // ── Handle choice selection ──
  function handleSelect(char: string) {
    if (!question || selected !== null) return;
    setSelected(char);

    const isCorrect = char === question.character || char === question.traditional;

    setScores((s) => {
      const lvl = question.hskLevel;
      const prev = s.byLevel[lvl] ?? { correct: 0, total: 0 };
      return {
        correct: s.correct + (isCorrect ? 1 : 0),
        wrong: s.wrong + (isCorrect ? 0 : 1),
        streak: isCorrect ? s.streak + 1 : 0,
        byLevel: {
          ...s.byLevel,
          [lvl]: { correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 },
        },
      };
    });

    if (isCorrect) {
      saveProgress(question.characterIndex, "reading");
    } else {
      setWrongAnswers((w) => [...w, {
        character: question.character,
        traditional: question.traditional,
        pinyin: question.pinyin,
        userAnswer: char,
        sentence: question.sentence,
        blanked: question.blanked,
        translation: question.translation,
        hskLevel: question.hskLevel,
        mode: "choice",
      }]);
    }
  }

  function handleNext() {
    loadQuestion(selectedLevels);
  }

  function toggleLevel(level: number) {
    setSelectedLevels((prev) => {
      if (prev.includes(level)) {
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== level);
      }
      return [...prev, level].sort();
    });
  }

  const hint = question ? getHint(question) : null;
  const isAnswered = selected !== null;

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <QuizShell
        scores={scores}
        selectedLevels={selectedLevels}
        onToggleLevel={(level) => { toggleLevel(level); loadQuestion(selectedLevels.includes(level) && selectedLevels.length > 1 ? selectedLevels.filter(l => l !== level) : [...selectedLevels, level].sort()); }}
        wrongAnswers={wrongAnswers}
      />

      {/* Question card */}
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="p-6 border-b space-y-4">
          {isLoading && <div className="text-center text-muted-foreground py-8 text-sm">Loading…</div>}
          {isError && (
            <div className="text-center text-destructive py-8 text-sm">
              Failed to load.{" "}
              <button onClick={() => loadQuestion(selectedLevels)} className="underline">Retry</button>
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

              {/* Sentence with blank */}
              <div className="font-serif text-3xl leading-relaxed tracking-wide">
                {(() => {
                  const parts = question.blanked.split("＿");
                  return (
                    <span>
                      {parts[0]}
                      <span className={`inline-block border-b-2 w-10 mx-1 text-center font-bold
                        ${isAnswered
                          ? selected === question.character || selected === question.traditional
                            ? "border-green-500 text-green-600"
                            : "border-red-500 text-red-600"
                          : "border-red-400 text-red-400"
                        }`}>
                        {isAnswered ? question.character : "＿"}
                      </span>
                      {parts[1]}
                    </span>
                  );
                })()}
              </div>

              {/* Translation — shown after answering */}
              {isAnswered && (
                <div className="text-sm text-muted-foreground italic">"{question.translation}"</div>
              )}

              {/* Hint */}
              {hint && (hint.pinyin || hint.definition) && (
                <div className="text-sm text-muted-foreground">
                  {hint.pinyin && (
                    <span className="font-medium text-foreground">{question.pinyin}</span>
                  )}
                  {hint.definition && (
                    <span> · {question.definition[0]}</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Choices grid */}
        {question && !isLoading && choices.length > 0 && (
          <div className="p-4 grid grid-cols-2 gap-3">
            {choices.map((choice, i) => {
              const isCorrect = choice.character === question.character || choice.character === question.traditional;
              const isSelected = selected === choice.character || selected === choice.traditional;
              let btnClass = "border rounded-xl p-3 text-center transition-all ";

              if (!isAnswered) {
                btnClass += "hover:border-foreground hover:bg-muted cursor-pointer border-border";
              } else if (isCorrect) {
                btnClass += "border-green-500 bg-green-50 text-green-800";
              } else if (isSelected) {
                btnClass += "border-red-400 bg-red-50 text-red-800";
              } else {
                btnClass += "border-border opacity-50";
              }

              return (
                <button
                  key={i}
                  className={btnClass}
                  onClick={() => handleSelect(choice.character)}
                  disabled={isAnswered}
                >
                  <div className="font-serif text-2xl">{choice.character}</div>
                  {choice.character !== choice.traditional && (
                    <div className="font-serif text-base text-muted-foreground">{choice.traditional}</div>
                  )}
                  {isAnswered && isCorrect && (
                    <CheckCircle className="w-4 h-4 text-green-600 mx-auto mt-1" />
                  )}
                  {isAnswered && isSelected && !isCorrect && (
                    <XCircle className="w-4 h-4 text-red-500 mx-auto mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Next button */}
      {isAnswered && (
        <div className="flex justify-end">
          <Button onClick={handleNext} variant="outline" className="gap-1">
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && !question && (
        <div className="text-center text-muted-foreground flex flex-col items-center gap-2 py-8">
          <BookOpen className="w-8 h-8 opacity-30" />
          <p className="text-sm">Select at least one HSK level to begin</p>
        </div>
      )}
    </div>
  );
}
