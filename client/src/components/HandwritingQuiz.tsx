import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ChevronRight, Eraser, BookOpen, Loader2, SkipForward } from "lucide-react";
import QuizShell from "./QuizShell";
import {
  HSK_COLORS, EMPTY_SCORES, getHint, saveProgress, fetchQuestion,
  type WrongAnswer, type QuizScores,
} from "./quizTypes";

interface Point { x: number; y: number; }
type Stroke = Point[];

declare global {
  interface Window {
    HanziLookup: {
      init: (dataName: string, dataUrl: string, cb: (ok: boolean) => void) => void;
      AnalyzedCharacter: new (strokes: number[][][]) => unknown;
      Matcher: new (dataName: string) => {
        match: (char: unknown, count: number, cb: (matches: Array<{ character: string; score: number }>) => void) => void;
      };
    };
  }
}

const CANVAS_SIZE = 280;

// ── HanziLookup loader (module-level singleton) ───────────────────────────────

let hanziReady = false;
let hanziLoading = false;
let hanziFailed = false;
const hanziCallbacks: Array<(ok: boolean) => void> = [];

function resetHanziForRetry() {
  hanziFailed = false;
  hanziLoading = false;
  hanziCallbacks.length = 0;
}

function ensureHanziLoaded(onDone: (ok: boolean) => void) {
  if (hanziReady) { onDone(true); return; }
  if (hanziFailed) { onDone(false); return; }
  hanziCallbacks.push(onDone);
  if (hanziLoading) return;
  hanziLoading = true;

  const fail = () => {
    hanziLoading = false; hanziFailed = true;
    hanziCallbacks.forEach((cb) => cb(false));
    hanziCallbacks.length = 0;
  };

  const script = document.createElement("script");
  script.src = "/hanzilookup.min.js";
  script.onerror = fail;
  script.onload = () => {
    try {
      window.HanziLookup.init("mmah", "/mmah.json", (ok) => {
        if (ok) {
          hanziReady = true; hanziLoading = false;
          hanziCallbacks.forEach((cb) => cb(true));
          hanziCallbacks.length = 0;
        } else { fail(); }
      });
    } catch { fail(); }
  };
  document.head.appendChild(script);
}

// ── Drawing canvas hook ───────────────────────────────────────────────────────

function useDrawingCanvas(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CANVAS_SIZE / 2, 0); ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE);
    ctx.moveTo(0, CANVAS_SIZE / 2); ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE / 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.04)";
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE);
    ctx.moveTo(CANVAS_SIZE, 0); ctx.lineTo(0, CANVAS_SIZE);
    ctx.stroke();

    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = Math.max(3, CANVAS_SIZE / 70);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
    if (currentStrokeRef.current && currentStrokeRef.current.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(currentStrokeRef.current[0].x, currentStrokeRef.current[0].y);
      for (let i = 1; i < currentStrokeRef.current.length; i++) {
        ctx.lineTo(currentStrokeRef.current[i].x, currentStrokeRef.current[i].y);
      }
      ctx.stroke();
    }
  }, [canvasRef]);

  const startStroke = useCallback((pos: Point) => {
    isDrawingRef.current = true; currentStrokeRef.current = [pos]; redraw();
  }, [redraw]);

  const continueStroke = useCallback((pos: Point) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    currentStrokeRef.current.push(pos); redraw();
  }, [redraw]);

  const endStroke = useCallback(() => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    if (currentStrokeRef.current.length >= 2) strokesRef.current.push(currentStrokeRef.current);
    currentStrokeRef.current = null; isDrawingRef.current = false; redraw();
  }, [redraw]);

  const clearCanvas = useCallback(() => {
    strokesRef.current = []; currentStrokeRef.current = null; isDrawingRef.current = false; redraw();
  }, [redraw]);

  const getStrokesForLookup = useCallback((): number[][][] =>
    strokesRef.current.map((s) => s.map((p) => [p.x, p.y])), []);

  return { startStroke, continueStroke, endStroke, clearCanvas, getStrokesForLookup, redraw };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HandwritingQuiz() {
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2, 3]);
  const [scores, setScores] = useState<QuizScores>({ ...EMPTY_SCORES, byLevel: {} });
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { startStroke, continueStroke, endStroke, clearCanvas, getStrokesForLookup, redraw } =
    useDrawingCanvas(canvasRef);

  useEffect(() => {
    ensureHanziLoaded((ok) => { if (ok) setEngineReady(true); else setEngineError(true); });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    redraw();
  }, [redraw]);

  const { data: question, isLoading, isError, refetch } = useQuery({
    queryKey: ["quiz-write", selectedLevels],
    queryFn: () => fetchQuestion(selectedLevels),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const recognize = useCallback(() => {
    if (!engineReady || !window.HanziLookup) return;
    const strokes = getStrokesForLookup();
    if (strokes.length === 0) return;
    setRecognizing(true);
    try {
      const analyzed = new window.HanziLookup.AnalyzedCharacter(strokes);
      const matcher = new window.HanziLookup.Matcher("mmah");
      matcher.match(analyzed, 8, (matches) => {
        setCandidates(matches.map((m) => m.character));
        setRecognizing(false);
      });
    } catch { setRecognizing(false); }
  }, [engineReady, getStrokesForLookup]);

  // ── Coordinate normalization ──
  // The canvas internal drawing space is CANVAS_SIZE × CANVAS_SIZE (logical pixels).
  // The canvas element is styled responsively (CSS width may differ from CANVAS_SIZE).
  // We must map from CSS/client coordinates into CANVAS_SIZE space.
  // Do NOT multiply by DPR — the ctx.scale(dpr,dpr) in the setup effect already handles that.
  function toCanvasPoint(clientX: number, clientY: number): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((clientY - rect.top) / rect.height) * CANVAS_SIZE,
    };
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (result) return;
    e.preventDefault();
    startStroke(toCanvasPoint(e.clientX, e.clientY));
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (result || e.buttons !== 1) return;
    continueStroke(toCanvasPoint(e.clientX, e.clientY));
  };
  const handleMouseUp = () => { if (!result) { endStroke(); recognize(); } };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (result) return; e.preventDefault();
    const t = e.touches[0];
    startStroke(toCanvasPoint(t.clientX, t.clientY));
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (result) return; e.preventDefault();
    const t = e.touches[0];
    continueStroke(toCanvasPoint(t.clientX, t.clientY));
  };
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (result) return; e.preventDefault(); endStroke(); recognize();
  };

  function selectCandidate(char: string) {
    if (!question || result) return;
    const isCorrect =
      char === question.character ||
      char === question.traditional ||
      (Array.isArray(question.traditionalVariants) && question.traditionalVariants.includes(char));
    setResult(isCorrect ? "correct" : "wrong");
    const lvl = question.hskLevel;
    setScores((s) => {
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
      saveProgress(question.characterIndex, "writing");
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
        mode: "write" as const,
      }]);
    }
  }

  const handleNext = useCallback(() => {
    setResult(null); setCandidates([]); clearCanvas(); refetch();
  }, [clearCanvas, refetch]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "n" || e.key === "N") {
        if (document.activeElement?.tagName === "INPUT") return;
        handleNext();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleNext]);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setEngineError(false);
    resetHanziForRetry();
    ensureHanziLoaded((ok) => {
      if (ok) setEngineReady(true); else setEngineError(true);
      setIsRetrying(false);
    });
  }, []);

  function handleSkip() {
    setScores((s) => ({ ...s, skipped: s.skipped + 1, streak: 0 }));
    setResult(null); setCandidates([]); clearCanvas(); refetch();
  }

  function toggleLevel(level: number) {
    setSelectedLevels((prev) => {
      if (prev.includes(level)) { if (prev.length === 1) return prev; return prev.filter((l) => l !== level); }
      return [...prev, level].sort();
    });
  }

  const hint = question ? getHint(question) : null;

  return (
    <div className="space-y-6">
      <QuizShell
        scores={scores}
        selectedLevels={selectedLevels}
        onToggleLevel={(level) => { toggleLevel(level); setResult(null); setCandidates([]); clearCanvas(); }}
        wrongAnswers={wrongAnswers}
      />

      {/* Question prompt */}
      <div className="border rounded-xl p-5 bg-card space-y-3">
        {isLoading && <div className="text-sm text-muted-foreground text-center py-4">Loading…</div>}
        {isError && (
          <div className="text-sm text-destructive text-center py-4">
            Failed to load.{" "}
            <button onClick={() => refetch()} className="underline">Retry</button>
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
            <div className="font-serif text-2xl leading-relaxed tracking-wide">
              {question.blanked}
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

      {/* Drawing area */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {engineError ? "Recognition engine failed to load"
              : !engineReady ? "Loading recognition engine…"
              : result === "correct" ? "✓ Correct!"
              : result === "wrong" ? "✗ Wrong — see answer below"
              : "Draw the missing character"}
          </p>
          <div className="flex gap-2">
            {!result && (
              <Button variant="ghost" size="sm" onClick={handleSkip} className="gap-1.5 text-xs text-muted-foreground">
                <SkipForward className="w-3.5 h-3.5" /> Skip
              </Button>
            )}
            <Button
              variant="outline" size="sm"
              onClick={() => { clearCanvas(); setCandidates([]); }}
              disabled={!!result}
              className="gap-1.5 text-xs"
            >
              <Eraser className="w-3.5 h-3.5" /> Erase
            </Button>
          </div>
        </div>

        <div className="relative mx-auto rounded-xl border-2 border-border overflow-hidden bg-white"
          style={{ width: "100%", maxWidth: CANVAS_SIZE, aspectRatio: "1/1" }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", touchAction: "none", cursor: result ? "default" : "crosshair" }}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          />
          {!engineReady && !engineError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {engineError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/90">
              <p className="text-sm text-destructive text-center px-4">Recognition engine failed to load</p>
              <Button size="sm" variant="outline" onClick={handleRetry} disabled={isRetrying}>
                {isRetrying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Retry"}
              </Button>
            </div>
          )}
        </div>

        {candidates.length > 0 && !result && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {recognizing ? "Recognising…" : "Tap your character:"}
            </p>
            <div className="flex flex-wrap gap-2">
              {candidates.map((char, i) => (
                <button key={i} onClick={() => selectCandidate(char)}
                  className="font-serif text-2xl w-12 h-12 rounded-lg border border-border hover:border-foreground hover:bg-muted transition-all flex items-center justify-center">
                  {char}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Feedback */}
      {result && question && (
        <div className={`rounded-xl border p-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200
          ${result === "correct" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {result === "correct"
              ? <><CheckCircle className="w-4 h-4" /> Correct!</>
              : <><XCircle className="w-4 h-4" /> The correct character is{" "}
                  <span className="font-serif text-xl">{question.character}</span>{" "}({question.pinyin})</>
            }
          </div>
          <p className="text-sm opacity-80">{question.definition.slice(0, 3).join(" · ")}</p>
          <div className="font-serif text-base opacity-75">
            {question.sentence}
            <span className="not-italic text-xs ml-2 font-sans">— {question.translation}</span>
          </div>
        </div>
      )}

      {result && (
        <div className="flex justify-end">
          <Button onClick={handleNext} variant="outline" className="gap-1">
            Next <ChevronRight className="w-4 h-4" />
          </Button>
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
