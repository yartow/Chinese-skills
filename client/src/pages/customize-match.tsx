import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Check, AlertCircle } from "lucide-react";

interface Source { id: number; name: string; }
interface CustomClass { id: number; name: string; sourceId: number; sourceName: string; }
interface Lesson { id: number; lesson: string; classId: number; sourceId: number; className: string; sourceName: string; }
interface MatchResult { matched: number; notFound: string[]; }

export default function CustomizeMatchPage() {
  const [, setLocation] = useLocation();

  const [sourceId, setSourceId] = useState("");
  const [classId, setClassId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [characters, setCharacters] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);

  const { data: sources = [] } = useQuery<Source[]>({ queryKey: ["/api/sources"] });
  const { data: classes = [] } = useQuery<CustomClass[]>({ queryKey: ["/api/classes"] });
  const { data: lessons = [] } = useQuery<Lesson[]>({ queryKey: ["/api/lessons"] });

  const filteredClasses = sourceId
    ? classes.filter(c => c.sourceId === Number(sourceId))
    : classes;

  const filteredLessons = classId
    ? lessons.filter(l => l.classId === Number(classId))
    : sourceId
      ? lessons.filter(l => l.sourceId === Number(sourceId))
      : lessons;

  const matchMutation = useMutation({
    mutationFn: ({ chars, lesson }: { chars: string; lesson: number }) =>
      apiRequest("POST", "/api/custom-matching", { characters: chars, lessonId: lesson }),
    onSuccess: (data) => setResult(data as MatchResult),
  });

  const handleSourceChange = (val: string) => {
    setSourceId(val);
    setClassId("");
    setLessonId("");
    setResult(null);
  };

  const handleClassChange = (val: string) => {
    setClassId(val);
    setLessonId("");
    setResult(null);
  };

  const canSubmit = lessonId && characters.trim() && !matchMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/customize")} className="gap-1 -ml-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Customize
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-1">Match characters to source</h1>
        <p className="text-sm text-muted-foreground">
          Select a lesson, then paste your traditional Chinese characters. Each character is matched individually.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Source</label>
          <Select value={sourceId} onValueChange={handleSourceChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select source…" />
            </SelectTrigger>
            <SelectContent>
              {sources.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
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
              {filteredClasses.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
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

        <div>
          <label className="text-sm font-medium mb-1.5 block">Characters</label>
          <Textarea
            placeholder="Paste traditional Chinese characters here…"
            value={characters}
            onChange={e => { setCharacters(e.target.value); setResult(null); }}
            rows={5}
            className="font-mono text-lg"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Punctuation and spaces are ignored — only Chinese characters are matched.
          </p>
        </div>

        <Button
          onClick={() => matchMutation.mutate({ chars: characters, lesson: Number(lessonId) })}
          disabled={!canSubmit}
          className="w-full"
        >
          {matchMutation.isPending ? "Matching…" : "Match characters"}
        </Button>
      </div>

      {result && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Check className="w-5 h-5" />
            <span className="font-medium">Matched {result.matched} character{result.matched !== 1 ? "s" : ""}</span>
          </div>
          {result.notFound.length > 0 && (
            <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Not found in database ({result.notFound.length}):</p>
                <p className="text-sm mt-1 font-mono tracking-widest">{result.notFound.join(" ")}</p>
              </div>
            </div>
          )}
        </Card>
      )}

      {matchMutation.isError && (
        <Card className="p-4 flex items-center gap-2 text-destructive border-destructive/30">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">Something went wrong. Please try again.</span>
        </Card>
      )}
    </div>
  );
}
