import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ClipboardList, X, Copy, Check } from "lucide-react";
import {
  ALL_LEVELS, HSK_COLORS, HSK_BG_SOLID,
  type QuizScores, type WrongAnswer,
} from "./quizTypes";

interface Props {
  scores: QuizScores;
  selectedLevels: number[];
  onToggleLevel: (level: number) => void;
  wrongAnswers: WrongAnswer[];
}

export default function QuizShell({ scores, selectedLevels, onToggleLevel, wrongAnswers }: Props) {
  const [showWrong, setShowWrong] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyWrongAnswers() {
    const lines = wrongAnswers.map((w, i) => {
      const charDisplay = w.character !== w.traditional ? `${w.character} (${w.traditional})` : w.character;
      return [
        `${i + 1}. HSK ${w.hskLevel} · ${charDisplay} · ${w.pinyin}`,
        `   ${w.sentence}  —  ${w.translation}`,
        `   Your answer: "${w.userAnswer || "(none)"}"  ·  Correct: ${w.character}`,
      ].join("\n");
    }).join("\n\n");
    navigator.clipboard.writeText(`Wrong answers (${wrongAnswers.length})\n\n${lines}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const total = scores.correct + scores.wrong;
  const pct = total === 0 ? null : Math.round((scores.correct / total) * 100);

  return (
    <div className="space-y-4">

      {/* ── Score bar ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Correct", value: scores.correct, color: "text-green-600" },
          { label: "Wrong",   value: scores.wrong,   color: "text-red-600"   },
          { label: "Streak",  value: scores.streak,  color: "text-orange-500"},
          { label: "Skipped", value: scores.skipped, color: "text-blue-500"  },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-muted rounded-lg p-3 text-center">
            <div className={`text-2xl font-semibold ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Level selector + per-level accuracy ── */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {ALL_LEVELS.map((level) => {
            const ls = scores.byLevel[level];
            const lvPct = ls && ls.total > 0
              ? Math.round((ls.correct / ls.total) * 100)
              : null;

            return (
              <button
                key={level}
                onClick={() => onToggleLevel(level)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                  ${selectedLevels.includes(level)
                    ? HSK_COLORS[level] + " border-current"
                    : "bg-background text-muted-foreground border-border hover:border-foreground"
                  }`}
              >
                {level === 0 ? "Unknown" : `HSK ${level}`}
                {lvPct !== null && selectedLevels.includes(level) && (
                  <span className="text-xs opacity-70">{lvPct}%</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Per-level accuracy bars — only for selected levels with attempts */}
        {selectedLevels.some(l => scores.byLevel[l]?.total > 0) && (
          <div className="space-y-1.5">
            {selectedLevels.map((level) => {
              const ls = scores.byLevel[level];
              if (!ls || ls.total === 0) return null;
              const lvPct = Math.round((ls.correct / ls.total) * 100);
              return (
                <div key={level} className="flex items-center gap-2">
                  <span className={`text-xs font-medium w-12 shrink-0 ${HSK_COLORS[level]?.split(" ")[1] ?? "text-gray-500"}`}>
                    {level === 0 ? "?" : `HSK ${level}`}
                  </span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${HSK_BG_SOLID[level]}`}
                      style={{ width: `${lvPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
                    {lvPct}% <span className="opacity-60">({ls.correct}/{ls.total})</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Show wrong answers button ── */}
      {wrongAnswers.length > 0 && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWrong(!showWrong)}
            className="gap-2 text-xs"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            {showWrong ? "Hide" : "Show"} wrong answers ({wrongAnswers.length})
          </Button>

          {showWrong && (
            <div className="mt-3 border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Wrong answers
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyWrongAnswers}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy all wrong answers"
                  >
                    {copied
                      ? <><Check className="w-3.5 h-3.5 text-green-600" /><span className="text-green-600">Copied</span></>
                      : <><Copy className="w-3.5 h-3.5" />Copy</>
                    }
                  </button>
                  <button onClick={() => setShowWrong(false)}>
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div className="divide-y max-h-72 overflow-y-auto">
                {wrongAnswers.map((w, i) => (
                  <div key={i} className="px-4 py-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${HSK_COLORS[w.hskLevel]}`}>
                        HSK {w.hskLevel}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{w.mode}</span>
                      <span className="font-serif text-base">{w.character}</span>
                      {w.character !== w.traditional && (
                        <span className="font-serif text-base text-muted-foreground">/ {w.traditional}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{w.pinyin}</span>
                    </div>
                    <div className="font-serif text-sm">
                      {w.sentence}
                      <span className="font-sans text-xs text-muted-foreground ml-2">— {w.translation}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Your answer:{" "}
                      <span className="font-serif text-red-600">{w.userAnswer || "—"}</span>
                      {" · "}Correct:{" "}
                      <span className="font-serif text-green-700">{w.character}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
