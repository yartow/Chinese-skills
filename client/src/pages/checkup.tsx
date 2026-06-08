import { useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authenticatedFetch, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { numberedPinyinToZhuyin } from "@/lib/zhuyin";
import WritingCanvas, { type GridType, type WritingCanvasHandle } from "@/components/WritingCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Checkup, CheckupItem } from "@shared/schema";

type CheckupWithItems = Checkup & { items: CheckupItem[] };

function displayPronunciation(item: CheckupItem, mode: string): string {
  if (mode === "zhuyin" && item.numberedPinyin) {
    return numberedPinyinToZhuyin(item.numberedPinyin);
  }
  return item.pinyin ?? "";
}

// ── Student: take the check-up ────────────────────────────────────────────────

function StudentTakeView({ checkup }: { checkup: CheckupWithItems }) {
  const [, setLocation] = useLocation();
  const [current, setCurrent] = useState(0);
  const canvasRefs = useRef<(WritingCanvasHandle | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const drawings = checkup.items.map((item, i) => ({
        id: item.id,
        drawing: canvasRefs.current[i]?.getDataUrl() ?? "",
      }));
      await apiRequest("POST", `/api/checkups/${checkup.id}/submit`, { drawings });
    },
    onSuccess: () => setSubmitted(true),
  });

  if (submitted) {
    return (
      <div className="text-center space-y-4 py-12">
        <p className="text-2xl">✓</p>
        <p className="text-lg font-semibold">Submitted!</p>
        <p className="text-muted-foreground">Your teacher will score it and let you know.</p>
        <Button variant="outline" onClick={() => setLocation("/messages")}>Back to messages</Button>
      </div>
    );
  }

  const item = checkup.items[current];
  const total = checkup.items.length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Character {current + 1} of {total}</span>
          <span>{Math.round(((current + 1) / total) * 100)}%</span>
        </div>
        <Progress value={((current + 1) / total) * 100} />
      </div>

      <div className="flex flex-col items-center gap-4">
        <p className="text-4xl font-medium tracking-widest text-muted-foreground">
          {displayPronunciation(item, checkup.displayMode)}
        </p>
        <WritingCanvas
          ref={el => { canvasRefs.current[current] = el; }}
          gridType={checkup.gridType as GridType}
          size={220}
        />
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" disabled={current === 0} onClick={() => setCurrent(c => c - 1)}>
          ← Previous
        </Button>
        {current < total - 1 ? (
          <Button onClick={() => setCurrent(c => c + 1)}>Next →</Button>
        ) : (
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? "Submitting…" : "Submit check-up"}
          </Button>
        )}
      </div>

      {/* Thumbnail row */}
      <div className="flex gap-2 flex-wrap justify-center pt-2">
        {checkup.items.map((it, i) => (
          <button
            key={it.id}
            onClick={() => setCurrent(i)}
            className={`w-10 h-10 rounded border text-xs flex items-center justify-center transition-colors
              ${i === current ? "border-primary bg-primary/10 font-bold" : "border-muted hover:border-primary/50"}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Teacher: score submitted check-up ─────────────────────────────────────────

function TeacherScoreView({ checkup }: { checkup: CheckupWithItems }) {
  const [, setLocation] = useLocation();
  const [scores, setScores] = useState<{ pointsAwarded: number; feedback: string }[]>(
    checkup.items.map(() => ({ pointsAwarded: checkup.maxPointsPerChar, feedback: "" }))
  );

  const scoreMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/checkups/${checkup.id}/score`, {
        scores: checkup.items.map((item, i) => ({
          id: item.id,
          pointsAwarded: scores[i].pointsAwarded,
          feedback: scores[i].feedback || undefined,
        })),
      }),
    onSuccess: () => setLocation(`/checkup/${checkup.id}`),
  });

  const total = scores.reduce((s, x) => s + x.pointsAwarded, 0);
  const max = checkup.items.length * checkup.maxPointsPerChar;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Score check-up — {total}/{max} pts</h2>
      <div className="space-y-8">
        {checkup.items.map((item, i) => (
          <Card key={item.id}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Expected</p>
                  <p className="text-5xl font-chinese">{item.character}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.pinyin}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Student wrote</p>
                  {item.drawing ? (
                    <WritingCanvas
                      gridType={checkup.gridType as GridType}
                      size={140}
                      readOnly
                      initialData={item.drawing}
                    />
                  ) : (
                    <div className="w-[140px] h-[140px] border rounded flex items-center justify-center text-muted-foreground text-sm">
                      No drawing
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2 min-w-[140px]">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Points (max {checkup.maxPointsPerChar})
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={checkup.maxPointsPerChar}
                      value={scores[i].pointsAwarded}
                      onChange={e => {
                        const v = Math.max(0, Math.min(checkup.maxPointsPerChar, parseInt(e.target.value) || 0));
                        setScores(prev => prev.map((s, j) => j === i ? { ...s, pointsAwarded: v } : s));
                      }}
                      className="w-24 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Feedback (optional)</label>
                    <Textarea
                      className="mt-1 text-sm"
                      rows={2}
                      placeholder="Well done / Watch the stroke order…"
                      value={scores[i].feedback}
                      onChange={e => setScores(prev => prev.map((s, j) => j === i ? { ...s, feedback: e.target.value } : s))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button
        className="w-full"
        onClick={() => scoreMutation.mutate()}
        disabled={scoreMutation.isPending}
      >
        {scoreMutation.isPending ? "Submitting…" : `Submit scores (${total}/${max} pts)`}
      </Button>
    </div>
  );
}

// ── Results (both roles) ──────────────────────────────────────────────────────

function ResultsView({ checkup }: { checkup: CheckupWithItems }) {
  const { user } = useAuth();
  const isTeacher = (user as any)?.id === checkup.teacherId;
  const total = checkup.items.reduce((s, it) => s + (it.pointsAwarded ?? 0), 0);
  const max = checkup.items.length * checkup.maxPointsPerChar;
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="text-4xl font-bold">{total}/{max}</p>
        <p className="text-muted-foreground">{pct}%</p>
        <Progress value={pct} className="mt-2" />
      </div>
      <div className="space-y-4">
        {checkup.items.map(item => (
          <Card key={item.id}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="text-center w-16">
                  <p className="text-4xl font-chinese">{item.character}</p>
                  <p className="text-xs text-muted-foreground">{item.pinyin}</p>
                </div>
                {item.drawing && (
                  <WritingCanvas
                    gridType={checkup.gridType as GridType}
                    size={120}
                    readOnly
                    initialData={item.drawing}
                  />
                )}
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    {item.pointsAwarded ?? 0} / {checkup.maxPointsPerChar} pts
                  </p>
                  {item.feedback && (
                    <p className="text-sm text-muted-foreground italic">"{item.feedback}"</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {isTeacher && (
        <p className="text-center text-sm text-muted-foreground">
          The student has been notified of these results.
        </p>
      )}
    </div>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────

export default function CheckupPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const id = parseInt(params.id ?? "");

  const { data: checkup, isLoading, error } = useQuery<CheckupWithItems>({
    queryKey: ["/api/checkups", id],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api/checkups/${id}`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !isNaN(id),
    staleTime: 0,
  });

  if (isLoading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;
  if (error || !checkup) return <div className="flex items-center justify-center py-20 text-destructive">Check-up not found.</div>;

  const userId = (user as any)?.id;
  const isTeacher = userId === checkup.teacherId;
  const isStudent = userId === checkup.studentId;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation(isTeacher ? "/teacher" : "/messages")}>
          ← Back
        </Button>
        <div>
          <h1 className="text-xl font-bold">Writing Check-up #{checkup.id}</h1>
          <p className="text-xs text-muted-foreground capitalize">
            {checkup.items.length} characters · {checkup.displayMode} · {checkup.gridType === "field" ? "田字格" : checkup.gridType === "cross" ? "十字格" : "Blank"} · Status: {checkup.status}
          </p>
        </div>
      </div>

      {isStudent && checkup.status === "pending" && <StudentTakeView checkup={checkup} />}
      {isStudent && checkup.status === "submitted" && (
        <div className="text-center py-12 space-y-2">
          <p className="text-lg font-semibold">Submitted ✓</p>
          <p className="text-muted-foreground">Your teacher is scoring your check-up. You'll get a message when it's done.</p>
        </div>
      )}
      {isStudent && checkup.status === "scored" && <ResultsView checkup={checkup} />}

      {isTeacher && checkup.status === "pending" && (
        <div className="text-center py-12 space-y-2">
          <p className="text-lg font-semibold">Waiting for student</p>
          <p className="text-muted-foreground">The student has not yet submitted this check-up.</p>
        </div>
      )}
      {isTeacher && checkup.status === "submitted" && <TeacherScoreView checkup={checkup} />}
      {isTeacher && checkup.status === "scored" && <ResultsView checkup={checkup} />}
    </div>
  );
}
