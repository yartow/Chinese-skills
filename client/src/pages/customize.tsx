import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type FormState = "hidden" | "open" | "success";

interface Source { id: number; name: string; createdAt: string; }
interface CustomClass { id: number; name: string; sourceId: number; sourceName: string; createdAt: string; }
interface Lesson { id: number; lesson: string; classId: number; sourceId: number; className: string; sourceName: string; createdAt: string; }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export default function CustomizePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // ─── Sources ───────────────────────────────────────────────────────────────
  const [sourceForm, setSourceForm] = useState<FormState>("hidden");
  const [sourceName, setSourceName] = useState("");

  const { data: sources = [] } = useQuery<Source[]>({ queryKey: ["/api/sources"] });

  const createSourceMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/sources", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      setSourceName("");
      setSourceForm("success");
    },
  });

  // ─── Classes ───────────────────────────────────────────────────────────────
  const [classForm, setClassForm] = useState<FormState>("hidden");
  const [className, setClassName] = useState("");
  const [classSourceId, setClassSourceId] = useState("");

  const { data: classes = [] } = useQuery<CustomClass[]>({ queryKey: ["/api/classes"] });

  const createClassMutation = useMutation({
    mutationFn: ({ name, sourceId }: { name: string; sourceId: number }) =>
      apiRequest("POST", "/api/classes", { name, sourceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setClassName("");
      setClassSourceId("");
      setClassForm("success");
    },
  });

  // ─── Lessons ───────────────────────────────────────────────────────────────
  const [lessonForm, setLessonForm] = useState<FormState>("hidden");
  const [lessonName, setLessonName] = useState("");
  const [lessonClassId, setLessonClassId] = useState("");

  const { data: lessons = [] } = useQuery<Lesson[]>({ queryKey: ["/api/lessons"] });

  const createLessonMutation = useMutation({
    mutationFn: ({ lesson, classId, sourceId }: { lesson: string; classId: number; sourceId: number }) =>
      apiRequest("POST", "/api/lessons", { lesson, classId, sourceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      setLessonName("");
      setLessonClassId("");
      setLessonForm("success");
    },
  });

  const selectedClass = classes.find(c => c.id === Number(lessonClassId));

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Customize</h1>
        <p className="text-muted-foreground">
          This page lets you map Chinese characters to your own source. Just create a source,
          write down your characters and then match the characters to the lesson and class.
        </p>
      </div>

      {/* ── Sources ──────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sources</h2>
          {sourceForm === "hidden" && (
            <Button onClick={() => setSourceForm("open")} variant="outline" size="sm">
              {sources.length === 0 ? "Create source" : "Create another source"}
            </Button>
          )}
        </div>

        {sourceForm === "open" && (
          <Card className="p-4 space-y-3">
            <p className="text-sm font-medium">New source</p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Oxford Publishing"
                value={sourceName}
                onChange={e => setSourceName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sourceName.trim() && createSourceMutation.mutate(sourceName)}
                autoFocus
              />
              <Button
                onClick={() => createSourceMutation.mutate(sourceName)}
                disabled={!sourceName.trim() || createSourceMutation.isPending}
              >
                {createSourceMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => { setSourceForm("hidden"); setSourceName(""); }}>
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {sourceForm === "success" && (
          <Card className="p-4 flex items-center justify-between bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <span className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <Check className="w-4 h-4" /> Source created!
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSourceForm("open")}>
                Create another source
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSourceForm("hidden")}>Done</Button>
            </div>
          </Card>
        )}

        {sources.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {sources.map(s => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Classes ──────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Classes</h2>
          {classForm === "hidden" && (
            <Button onClick={() => setClassForm("open")} variant="outline" size="sm">
              {classes.length === 0 ? "Create class" : "Create another class"}
            </Button>
          )}
        </div>

        {classForm === "open" && (
          <Card className="p-4 space-y-3">
            <p className="text-sm font-medium">New class</p>
            <Select value={classSourceId} onValueChange={setClassSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source…" />
              </SelectTrigger>
              <SelectContent>
                {sources.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sources.length === 0 && (
              <p className="text-xs text-muted-foreground">Create a source first before adding a class.</p>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Class 101"
                value={className}
                onChange={e => setClassName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && className.trim() && classSourceId)
                    createClassMutation.mutate({ name: className, sourceId: Number(classSourceId) });
                }}
                autoFocus
              />
              <Button
                onClick={() => createClassMutation.mutate({ name: className, sourceId: Number(classSourceId) })}
                disabled={!className.trim() || !classSourceId || createClassMutation.isPending}
              >
                {createClassMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => { setClassForm("hidden"); setClassName(""); setClassSourceId(""); }}>
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {classForm === "success" && (
          <Card className="p-4 flex items-center justify-between bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <span className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <Check className="w-4 h-4" /> Class created!
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setClassForm("open")}>
                Create another class
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setClassForm("hidden")}>Done</Button>
            </div>
          </Card>
        )}

        {classes.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Source</th>
                  <th className="text-left px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {classes.map(c => (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{c.sourceName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Lessons ──────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Lessons</h2>
          {lessonForm === "hidden" && (
            <Button
              onClick={() => setLessonForm("open")}
              variant="outline"
              size="sm"
              disabled={classes.length === 0}
              title={classes.length === 0 ? "Create a class first" : undefined}
            >
              {lessons.length === 0 ? "Create lesson" : "Create another lesson"}
            </Button>
          )}
        </div>

        {classes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Create a class first to enable lesson creation.
          </p>
        )}

        {lessonForm === "open" && (
          <Card className="p-4 space-y-3">
            <p className="text-sm font-medium">New lesson</p>
            <Select value={lessonClassId} onValueChange={setLessonClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Select class…" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name} <span className="text-muted-foreground">({c.sourceName})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClass && (
              <p className="text-xs text-muted-foreground">
                Source: <strong>{selectedClass.sourceName}</strong>
              </p>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Lesson 1"
                value={lessonName}
                onChange={e => setLessonName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && lessonName.trim() && selectedClass)
                    createLessonMutation.mutate({
                      lesson: lessonName,
                      classId: selectedClass.id,
                      sourceId: selectedClass.sourceId,
                    });
                }}
                autoFocus
              />
              <Button
                onClick={() => selectedClass && createLessonMutation.mutate({
                  lesson: lessonName,
                  classId: selectedClass.id,
                  sourceId: selectedClass.sourceId,
                })}
                disabled={!lessonName.trim() || !lessonClassId || createLessonMutation.isPending}
              >
                {createLessonMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => { setLessonForm("hidden"); setLessonName(""); setLessonClassId(""); }}>
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {lessonForm === "success" && (
          <Card className="p-4 flex items-center justify-between bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <span className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <Check className="w-4 h-4" /> Lesson created!
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setLessonForm("open")}>
                Create another lesson
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLessonForm("hidden")}>Done</Button>
            </div>
          </Card>
        )}

        {lessons.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Lesson</th>
                  <th className="text-left px-4 py-2 font-medium">Class</th>
                  <th className="text-left px-4 py-2 font-medium">Source</th>
                  <th className="text-left px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {lessons.map(l => (
                  <tr key={l.id} className="border-t">
                    <td className="px-4 py-2">{l.lesson}</td>
                    <td className="px-4 py-2">{l.className}</td>
                    <td className="px-4 py-2 text-muted-foreground">{l.sourceName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Match characters ─────────────────────────────────────────────── */}
      <section className="pt-2 border-t">
        <Button
          onClick={() => setLocation("/customize/match")}
          className={cn("gap-2", lessons.length === 0 && "opacity-50")}
          disabled={lessons.length === 0}
          title={lessons.length === 0 ? "Create a lesson first" : undefined}
        >
          Match characters to source
          <ChevronRight className="w-4 h-4" />
        </Button>
        {lessons.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Create at least one lesson to start matching characters.</p>
        )}
      </section>
    </div>
  );
}
