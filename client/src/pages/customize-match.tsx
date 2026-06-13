import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Check, AlertCircle } from "lucide-react";

interface Source { id: number; name: string; }
interface CustomClass { id: number; name: string; sourceId: number; sourceName: string; }
interface Lesson { id: number; lesson: string; classId: number; sourceId: number; className: string; sourceName: string; }
interface Relationship { id: number; teacherId: string; studentId: string; teacherName: string; studentName: string; }
interface MatchResult { matched: number; notFound: string[]; }
interface CombinedResult { core: MatchResult; other: MatchResult; }

function extractHan(text: string): string[] {
  return [...new Set([...text].filter(c => /\p{Script=Han}/u.test(c)))];
}

export default function CustomizeMatchPage() {
  const [, setLocation] = useLocation();

  const [relationshipId, setRelationshipId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [classId, setClassId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [coreText, setCoreText] = useState("");
  const [otherText, setOtherText] = useState("");
  const [result, setResult] = useState<CombinedResult | null>(null);

  // Conflict resolution state
  const [conflictQueue, setConflictQueue] = useState<string[]>([]);
  const [pendingCoreSet, setPendingCoreSet] = useState<Set<string>>(new Set());
  const [pendingOtherSet, setPendingOtherSet] = useState<Set<string>>(new Set());

  const { data: relationships = [] } = useQuery<Relationship[]>({ queryKey: ["/api/relationships"] });
  const { data: sources = [] } = useQuery<Source[]>({ queryKey: ["/api/sources"] });
  const { data: classes = [] } = useQuery<CustomClass[]>({ queryKey: ["/api/classes"] });
  const { data: lessons = [] } = useQuery<Lesson[]>({ queryKey: ["/api/lessons"] });

  const filteredClasses = sourceId ? classes.filter(c => c.sourceId === Number(sourceId)) : classes;
  const filteredLessons = classId
    ? lessons.filter(l => l.classId === Number(classId))
    : sourceId ? lessons.filter(l => l.sourceId === Number(sourceId)) : lessons;

  const hasRelationships = relationships.length > 0;

  const submitMutation = useMutation({
    mutationFn: async ({ coreChars, otherChars }: { coreChars: string[]; otherChars: string[] }) => {
      const post = async (chars: string[], core: boolean): Promise<MatchResult> => {
        if (chars.length === 0) return { matched: 0, notFound: [] };
        const body: Record<string, unknown> = {
          characters: chars.join(""),
          lessonId: Number(lessonId),
          core,
        };
        if (hasRelationships && relationshipId) body.teacherStudentId = Number(relationshipId);
        const res = await apiRequest("POST", "/api/custom-matching", body);
        return res.json() as Promise<MatchResult>;
      };
      const [coreResult, otherResult] = await Promise.all([
        post(coreChars, true),
        post(otherChars, false),
      ]);
      return { core: coreResult, other: otherResult };
    },
    onSuccess: (data) => setResult(data),
  });

  const handleSourceChange = (val: string) => {
    setSourceId(val); setClassId(""); setLessonId(""); setResult(null);
  };
  const handleClassChange = (val: string) => {
    setClassId(val); setLessonId(""); setResult(null);
  };

  const handleMatch = () => {
    setResult(null);
    const coreChars = extractHan(coreText);
    const otherChars = extractHan(otherText);
    const conflicts = coreChars.filter(c => otherChars.includes(c));

    if (conflicts.length > 0) {
      setPendingCoreSet(new Set(coreChars));
      setPendingOtherSet(new Set(otherChars));
      setConflictQueue(conflicts);
    } else {
      submitMutation.mutate({ coreChars, otherChars });
    }
  };

  const resolveConflict = (char: string, decision: "core" | "other" | "cancel") => {
    if (decision === "cancel") {
      setConflictQueue([]);
      return;
    }
    const newCore = new Set(pendingCoreSet);
    const newOther = new Set(pendingOtherSet);
    if (decision === "core") newOther.delete(char);
    else newCore.delete(char);

    const remaining = conflictQueue.slice(1);
    if (remaining.length > 0) {
      setPendingCoreSet(newCore);
      setPendingOtherSet(newOther);
      setConflictQueue(remaining);
    } else {
      setConflictQueue([]);
      submitMutation.mutate({ coreChars: [...newCore], otherChars: [...newOther] });
    }
  };

  const currentConflict = conflictQueue[0] ?? null;
  const relationshipReady = !hasRelationships || !!relationshipId;
  const canSubmit = relationshipReady && lessonId && (coreText.trim() || otherText.trim()) && !submitMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">

      <Dialog open={!!currentConflict} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Character conflict</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed">
            Character <em>{currentConflict}</em> is input as Core and as Other. Which category should it be assigned to?
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-start">
            <Button onClick={() => resolveConflict(currentConflict!, "core")}>Core</Button>
            <Button variant="outline" onClick={() => resolveConflict(currentConflict!, "other")}>Other</Button>
            <Button variant="ghost" onClick={() => resolveConflict(currentConflict!, "cancel")}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/customize")} className="gap-1 -ml-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Customize
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-1">Match characters to source</h1>
        <p className="text-sm text-muted-foreground">
          Select a lesson, then paste your traditional Chinese characters into the appropriate box.
        </p>
      </div>

      <div className="space-y-3">
        {hasRelationships && (
          <div>
            <label className="text-sm font-medium mb-1.5 block">Relationship</label>
            <Select value={relationshipId} onValueChange={v => { setRelationshipId(v); setResult(null); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select teacher–student relationship…" />
              </SelectTrigger>
              <SelectContent>
                {relationships.map(r => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.teacherName} → {r.studentName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-1.5 block">Source</label>
          <Select value={sourceId} onValueChange={handleSourceChange}>
            <SelectTrigger><SelectValue placeholder="Select source…" /></SelectTrigger>
            <SelectContent>
              {sources.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Class</label>
          <Select value={classId} onValueChange={handleClassChange} disabled={filteredClasses.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={filteredClasses.length === 0 ? "No classes available" : "Select class…"} />
            </SelectTrigger>
            <SelectContent>
              {filteredClasses.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Lesson</label>
          <Select
            value={lessonId}
            onValueChange={v => { setLessonId(v); setResult(null); }}
            disabled={filteredLessons.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={filteredLessons.length === 0 ? "No lessons available" : "Select lesson…"} />
            </SelectTrigger>
            <SelectContent>
              {filteredLessons.map(l => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.lesson}
                  {!classId && <span className="text-muted-foreground ml-1">({l.className})</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Core characters</label>
            <Textarea
              placeholder="New characters introduced in this lesson…"
              value={coreText}
              onChange={e => { setCoreText(e.target.value); setResult(null); }}
              rows={6}
              className="font-mono text-lg"
            />
            <p className="mt-1 text-xs text-muted-foreground">New characters introduced in this lesson</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Other characters</label>
            <Textarea
              placeholder="Previously taught characters that reappear…"
              value={otherText}
              onChange={e => { setOtherText(e.target.value); setResult(null); }}
              rows={6}
              className="font-mono text-lg"
            />
            <p className="mt-1 text-xs text-muted-foreground">Previously taught characters that reappear</p>
          </div>
        </div>

        <Button onClick={handleMatch} disabled={!canSubmit} className="w-full">
          {submitMutation.isPending ? "Matching…" : "Match characters"}
        </Button>
      </div>

      {result && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Check className="w-5 h-5" />
            <span className="font-medium">
              Matched {result.core.matched} core + {result.other.matched} other
            </span>
          </div>
          {result.core.notFound.length > 0 && (
            <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Core — not found ({result.core.notFound.length}):</p>
                <p className="text-sm mt-1 font-mono tracking-widest">{result.core.notFound.join(" ")}</p>
              </div>
            </div>
          )}
          {result.other.notFound.length > 0 && (
            <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Other — not found ({result.other.notFound.length}):</p>
                <p className="text-sm mt-1 font-mono tracking-widest">{result.other.notFound.join(" ")}</p>
              </div>
            </div>
          )}
        </Card>
      )}

      {submitMutation.isError && (
        <Card className="p-4 flex items-center gap-2 text-destructive border-destructive/30">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">Something went wrong. Please try again.</span>
        </Card>
      )}
    </div>
  );
}
