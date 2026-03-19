import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ChevronRight, Eraser, BookOpen, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuizQuestion {
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

interface Point { x: number; y: number; }
type Stroke = Point[];

// HanziLookup globals (loaded via script tag)
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

// ── HSK colours ───────────────────────────────────────────────────────────────

const HSK_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-700 border-red-200",
  2: "bg-orange-100 text-orange-700 border-orange-200",
  3: "bg-yellow-100 text-yellow-700 border-yellow-200",
  4: "bg-green-100 text-green-700 border-green-200",
  5: "bg-blue-100 text-blue-700 border-blue-200",
  6: "bg-purple-100 text-purple-700 border-purple-200",
};

const ALL_LEVELS = [1, 2, 3, 4, 5, 6];
const CANVAS_SIZE = 280; // logical px — scaled for device pixel ratio

// ── Load HanziLookup script + data once ──────────────────────────────────────

let hanziReady = false;
let hanziLoading = false;
let hanziFailed = false;
const hanziCallbacks: Array<(ok: boolean) => void> = [];

function ensureHanziLoaded(onDone: (ok: boolean) => void) {
  if (hanziReady) { onDone(true); return; }
  if (hanziFailed) { onDone(false); return; }
  hanziCallbacks.push(onDone);
  if (hanziLoading) return;
  hanziLoading = true;

  const fail = () => {
    hanziLoading = false;
    hanziFailed = true;
    hanziCallbacks.forEach((cb) => cb(false));
    hanziCallbacks.length = 0;
  };

  // Load the JS library from local public folder
  const script = document.createElement("script");
  script.src = "/hanzilookup.min.js";
  script.onerror = fail;
  script.onload = () => {
    try {
      // Load the mmah data file from local public folder
      window.HanziLookup.init(
        "mmah",
        "/mmah.json",
        (ok) => {
          if (ok) {
            hanziReady = true;
            hanziLoading = false;
            hanziCallbacks.forEach((cb) => cb(true));
            hanziCallbacks.length = 0;
          } else {
            fail();
          }
        }
      );
    } catch {
      fail();
    }
  };
  document.head.appendChild(script);
}

// ── Drawing canvas hook ───────────────────────────────────────────────────────

function useDrawingCanvas(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);

  const getPos = (e: MouseEvent | Touch, canvas: HTMLCanvasElement): Point => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "clientX" in e ? e.clientX : (e as Touch).clientX;
    const clientY = "clientY" in e ? e.clientY : (e as Touch).clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    // ctx.scale(dpr, dpr) is already applied, so all coordinates are in logical px (0..CANVAS_SIZE)
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid lines
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CANVAS_SIZE / 2, 0); ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE);
    ctx.moveTo(0, CANVAS_SIZE / 2); ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE / 2);
    ctx.stroke();

    // Diagonal guides
    ctx.strokeStyle = "rgba(0,0,0,0.04)";
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE);
    ctx.moveTo(CANVAS_SIZE, 0); ctx.lineTo(0, CANVAS_SIZE);
    ctx.stroke();

    // Draw all completed strokes
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = Math.max(3, CANVAS_SIZE / 70);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
    // Draw current stroke in progress
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
    isDrawingRef.current = true;
    currentStrokeRef.current = [pos];
    redraw();
  }, [redraw]);

  const continueStroke = useCallback((pos: Point) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    currentStrokeRef.current.push(pos);
    redraw();
  }, [redraw]);

  const endStroke = useCallback(() => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    if (currentStrokeRef.current.length >= 2) {
      strokesRef.current.push(currentStrokeRef.current);
    }
    currentStrokeRef.current = null;
    isDrawingRef.current = false;
    redraw();
  }, [redraw]);

  const clearCanvas = useCallback(() => {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    isDrawingRef.current = false;
    redraw();
  }, [redraw]);

  // Convert strokes to HanziLookup format: number[][][]
  const getStrokesForLookup = useCallback((): number[][][] => {
    return strokesRef.current.map((stroke) =>
      stroke.map((p) => [p.x, p.y])
    );
  }, []);

  const hasStrokes = useCallback(() => strokesRef.current.length > 0, []);

  return { startStroke, continueStroke, endStroke, clearCanvas, getStrokesForLookup, hasStrokes, redraw };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HandwritingQuiz() {
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2, 3]);
  const [scores, setScores] = useState({ correct: 0, wrong: 0, streak: 0 });
  const [candidates, setCandidates] = useState<string[]>([]);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [hanziReady, setHanziReady] = useState(false);
  const [hanziError, setHanziError] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { startStroke, continueStroke, endStroke, clearCanvas, getStrokesForLookup, hasStrokes, redraw } =
    useDrawingCanvas(canvasRef);

  // ── Load HanziLookup ──
  useEffect(() => {
    ensureHanziLoaded((ok) => {
      if (ok) setHanziReady(true);
      else setHanziError(true);
    });
  }, []);

  // ── Setup canvas DPR scaling ──
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

  // ── Fetch question ──
  const { data: question, isLoading, isError, refetch } = useQuery({
    queryKey: ["quiz-question-handwriting", selectedLevels],
    queryFn: async () => {
      const res = await fetch(`/api/quiz/question?levels=${selectedLevels.join(",")}`);
      if (!res.ok) throw new Error("Failed to load question");
      return res.json() as Promise<QuizQuestion>;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // ── Mouse events ──
  // Normalize CSS offsetX/Y → logical canvas coords (0..CANVAS_SIZE).
  // ctx.scale(dpr, dpr) already handles retina; we just account for responsive scaling.
  const normMouse = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.nativeEvent.offsetX / rect.width) * CANVAS_SIZE,
      y: (e.nativeEvent.offsetY / rect.height) * CANVAS_SIZE,
    };
  };
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (result) return;
    e.preventDefault();
    startStroke(normMouse(e));
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (result) return;
    if (e.buttons !== 1) return;
    continueStroke(normMouse(e));
  };
  const handleMouseUp = () => { if (!result) { endStroke(); recognize(); } };

  // ── Touch events (mobile + Wacom) ──
  // Normalize touch clientX/Y → logical canvas coords (0..CANVAS_SIZE).
  const normTouch = (t: React.Touch, rect: DOMRect) => ({
    x: ((t.clientX - rect.left) / rect.width) * CANVAS_SIZE,
    y: ((t.clientY - rect.top) / rect.height) * CANVAS_SIZE,
  });
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (result) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    startStroke(normTouch(e.touches[0], rect));
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (result) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    continueStroke(normTouch(e.touches[0], rect));
  };
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (result) return;
    e.preventDefault();
    endStroke();
    recognize();
  };

  // ── Recognition ──
  const recognize = useCallback(() => {
    if (!hanziReady || !window.HanziLookup) return;
    const strokes = getStrokesForLookup();
    if (strokes.length === 0) return;
    setRecognizing(true);
    try {
      const analyzed = new window.HanziLookup.AnalyzedCharacter(strokes);
      const matcher = new window.HanziLookup.Matcher("mmah");
      matcher.match(analyzed, 8, (matches) => {
        const chars = matches.map((m) => m.character);
        setCandidates(chars);
        setRecognizing(false);
      });
    } catch {
      setRecognizing(false);
    }
  }, [hanziReady, getStrokesForLookup]);

  // ── Check if candidate matches ──
  function selectCandidate(char: string) {
    if (!question || result) return;
    const variants = question.traditionalVariants ?? [];
    const isCorrect =
      char === question.character ||
      char === question.traditional ||
      variants.includes(char);
    setResult(isCorrect ? "correct" : "wrong");
    setScores((s) => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      wrong: s.wrong + (isCorrect ? 0 : 1),
      streak: isCorrect ? s.streak + 1 : 0,
    }));
  }

  function handleNext() {
    setResult(null);
    setCandidates([]);
    clearCanvas();
    refetch();
  }

  function handleErase() {
    clearCanvas();
    setCandidates([]);
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

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">

      {/* Score bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Correct", value: scores.correct, color: "text-green-600" },
          { label: "Wrong",   value: scores.wrong,   color: "text-red-600"   },
          { label: "Streak",  value: scores.streak,  color: "text-orange-500"},
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
            onClick={() => { toggleLevel(level); setResult(null); setCandidates([]); clearCanvas(); }}
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

            <div className="font-serif text-2xl leading-relaxed tracking-wide text-foreground">
              {question.blanked.replace("＿", "＿")}
            </div>
            {/* Translation only shown after answer is submitted */}
            {result && (
              <div className="text-sm text-muted-foreground italic">"{question.translation}"</div>
            )}

            {/* Hint */}
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{question.pinyin}</span>
              {" · "}
              {question.definition[0]}
            </div>
          </>
        )}
      </div>

      {/* Drawing area */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {hanziError
              ? "Recognition engine failed to load"
              : !hanziReady
              ? "Loading recognition engine…"
              : result
              ? result === "correct" ? "✓ Correct!" : "✗ Wrong — try again or skip"
              : "Draw the missing character below"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleErase}
            disabled={!!result}
            className="gap-1.5 text-xs"
          >
            <Eraser className="w-3.5 h-3.5" />
            Erase
          </Button>
        </div>

        {/* Canvas */}
        <div className="relative mx-auto rounded-xl border-2 border-border overflow-hidden bg-white"
          style={{ width: "100%", maxWidth: CANVAS_SIZE, aspectRatio: "1/1" }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", touchAction: "none", cursor: result ? "default" : "crosshair" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
          {!hanziReady && !hanziError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {hanziError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/90">
              <p className="text-sm text-destructive text-center px-4">Recognition engine failed to load</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Reset module-level flags so ensureHanziLoaded retries
                  hanziFailed = false;
                  setHanziError(false);
                  ensureHanziLoaded((ok) => {
                    if (ok) setHanziReady(true);
                    else setHanziError(true);
                  });
                }}
              >
                Retry
              </Button>
            </div>
          )}
        </div>

        {/* Candidates */}
        {candidates.length > 0 && !result && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {recognizing ? "Recognising…" : "Tap your character:"}
            </p>
            <div className="flex flex-wrap gap-2">
              {candidates.map((char, i) => (
                <button
                  key={i}
                  onClick={() => selectCandidate(char)}
                  className="font-serif text-2xl w-12 h-12 rounded-lg border border-border hover:border-foreground hover:bg-muted transition-all flex items-center justify-center"
                >
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
          ${result === "correct"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {result === "correct"
              ? <><CheckCircle className="w-4 h-4" /> Correct!</>
              : <><XCircle className="w-4 h-4" /> The correct character is{" "}
                  <span className="font-serif text-xl">{question.character}</span>
                  {" "}({question.pinyin})
                </>
            }
          </div>
          <p className="text-sm opacity-80">
            {question.definition.slice(0, 3).join(" · ")}
          </p>
          <div className="font-serif text-base opacity-75">
            {question.sentence}
            <span className="not-italic text-xs ml-2 font-sans">— {question.translation}</span>
          </div>
        </div>
      )}

      {/* Next button */}
      {result && (
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
