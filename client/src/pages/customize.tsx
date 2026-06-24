import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { Check, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type FormState = "hidden" | "open" | "success";

interface Source { id: number; userId: string; name: string; createdAt: string; }
interface CustomClass { id: number; userId: string; name: string; sourceId: number; sourceName: string; createdAt: string; }
interface Lesson { id: number; userId: string; lesson: string; classId: number; sourceId: number; className: string; sourceName: string; createdAt: string; }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

// ─── Sort helpers ────────────────────────────────────────────────────────────

// Parses a lesson string like "3", "3上", "3下", "12上" into numeric + suffix parts.
// 上 is treated as 'a' (first half) and 下 as 'b' (second half), so 3上 < 3下.
function compareLessonStr(a: string, b: string): number {
  const parse = (s: string) => {
    const m = s.match(/^(\d+)([上下]?)(.*)$/u);
    if (!m) return null;
    return { num: parseInt(m[1], 10), suffix: m[2] as '上' | '下' | '', tail: m[3] };
  };
  const pa = parse(a), pb = parse(b);
  if (pa && pb) {
    if (pa.num !== pb.num) return pa.num - pb.num;
    const order = (s: string) => s === '上' ? 0 : s === '下' ? 1 : 2;
    const so = order(pa.suffix) - order(pb.suffix);
    if (so !== 0) return so;
    return pa.tail.localeCompare(pb.tail);
  }
  return a.localeCompare(b, 'zh');
}

function sortedSources(arr: Source[]) {
  return [...arr].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
}

function sortedClasses(arr: CustomClass[]) {
  return [...arr].sort((a, b) => {
    const s = a.sourceName.localeCompare(b.sourceName, 'zh');
    return s !== 0 ? s : a.name.localeCompare(b.name, 'zh');
  });
}

function sortedLessons(arr: Lesson[]) {
  return [...arr].sort((a, b) => {
    const s = a.sourceName.localeCompare(b.sourceName, 'zh');
    if (s !== 0) return s;
    const l = compareLessonStr(a.lesson, b.lesson);
    if (l !== 0) return l;
    return a.className.localeCompare(b.className, 'zh');
  });
}

async function patchJson(url: string, body: unknown) {
  const res = await apiRequest("PATCH", url, body);
  return res.json();
}
async function deleteReq(url: string) {
  await apiRequest("DELETE", url);
}

// ─── Reusable inline-edit row ───────────────────────────────────────────────

interface EditRowProps {
  value: string;
  onSave: (name: string) => void;
  onDelete: () => void;
  onCancel: () => void;
  saving?: boolean;
  deleting?: boolean;
  error?: string;
}

function EditRow({ value, onSave, onDelete, onCancel, saving, deleting, error }: EditRowProps) {
  const [draft, setDraft] = useState(value);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex gap-2 items-center">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && draft.trim()) onSave(draft.trim()); if (e.key === "Escape") onCancel(); }}
          autoFocus
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={() => draft.trim() && onSave(draft.trim())} disabled={!draft.trim() || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {!confirmDelete ? (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        ) : (
          <span className="flex items-center gap-1 text-sm">
            <span className="text-destructive font-medium">Delete?</span>
            <Button size="sm" variant="destructive" onClick={onDelete} disabled={deleting}>
              {deleting ? "…" : "Yes"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>No</Button>
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      {error && <p className="text-xs text-destructive pl-1">{error}</p>}
    </div>
  );
}

export default function CustomizePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // ─── Sources ───────────────────────────────────────────────────────────────
  const [sourceForm, setSourceForm] = useState<FormState>("hidden");
  const [sourceName, setSourceName] = useState("");
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null);

  const { data: sources = [] } = useQuery<Source[]>({ queryKey: ["/api/sources"] });

  const createSourceMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/sources", { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sources"] }); setSourceName(""); setSourceForm("success"); },
  });

  const updateSourceMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => patchJson(`/api/sources/${id}`, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sources"] }); setEditingSourceId(null); },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: (id: number) => deleteReq(`/api/sources/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sources"] }); queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); queryClient.invalidateQueries({ queryKey: ["/api/lessons"] }); setEditingSourceId(null); },
  });

  // ─── Classes ───────────────────────────────────────────────────────────────
  const [classForm, setClassForm] = useState<FormState>("hidden");
  const [className, setClassName] = useState("");
  const [classSourceId, setClassSourceId] = useState("");
  const [editingClassId, setEditingClassId] = useState<number | null>(null);

  const { data: classes = [] } = useQuery<CustomClass[]>({ queryKey: ["/api/classes"] });

  const createClassMutation = useMutation({
    mutationFn: ({ name, sourceId }: { name: string; sourceId: number }) => apiRequest("POST", "/api/classes", { name, sourceId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); setClassName(""); setClassSourceId(""); setClassForm("success"); },
  });

  const updateClassMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => patchJson(`/api/classes/${id}`, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); setEditingClassId(null); },
  });

  const deleteClassMutation = useMutation({
    mutationFn: (id: number) => deleteReq(`/api/classes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); queryClient.invalidateQueries({ queryKey: ["/api/lessons"] }); setEditingClassId(null); },
  });

  // ─── Lessons ───────────────────────────────────────────────────────────────
  const [lessonForm, setLessonForm] = useState<FormState>("hidden");
  const [lessonName, setLessonName] = useState("");
  const [lessonClassId, setLessonClassId] = useState("");
  const [createLessonError, setCreateLessonError] = useState("");
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [editLessonError, setEditLessonError] = useState("");

  const { data: lessons = [] } = useQuery<Lesson[]>({ queryKey: ["/api/lessons"] });

  const createLessonMutation = useMutation({
    mutationFn: ({ lesson, classId, sourceId }: { lesson: string; classId: number; sourceId: number }) =>
      apiRequest("POST", "/api/lessons", { lesson, classId, sourceId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/lessons"] }); setLessonName(""); setLessonClassId(""); setLessonForm("success"); setCreateLessonError(""); },
    onError: (err: any) => {
      try { const body = JSON.parse(err.message?.replace(/^\d+:\s*/, '')); setCreateLessonError(body?.message ?? "Could not create lesson."); }
      catch { setCreateLessonError("Could not create lesson."); }
    },
  });

  const updateLessonMutation = useMutation({
    mutationFn: ({ id, lesson }: { id: number; lesson: string }) => patchJson(`/api/lessons/${id}`, { lesson }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/lessons"] }); setEditingLessonId(null); setEditLessonError(""); },
    onError: (err: any) => {
      try { const body = JSON.parse(err.message?.replace(/^\d+:\s*/, '')); setEditLessonError(body?.message ?? "Could not rename lesson."); }
      catch { setEditLessonError("Could not rename lesson."); }
    },
  });

  const deleteLessonMutation = useMutation({
    mutationFn: (id: number) => deleteReq(`/api/lessons/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/lessons"] }); setEditingLessonId(null); },
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
              <Input placeholder="e.g. Oxford Publishing" value={sourceName} onChange={e => setSourceName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sourceName.trim() && createSourceMutation.mutate(sourceName)} autoFocus />
              <Button onClick={() => createSourceMutation.mutate(sourceName)} disabled={!sourceName.trim() || createSourceMutation.isPending}>
                {createSourceMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => { setSourceForm("hidden"); setSourceName(""); }}>Cancel</Button>
            </div>
          </Card>
        )}

        {sourceForm === "success" && (
          <Card className="p-4 flex items-center justify-between bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <span className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400"><Check className="w-4 h-4" /> Source created!</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSourceForm("open")}>Create another source</Button>
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
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {sortedSources(sources).map(s => {
                  const isOwn = s.userId === (user as any)?.id;
                  return (
                    <tr key={s.id} className="border-t">
                      {editingSourceId === s.id ? (
                        <td colSpan={3} className="px-4 py-1">
                          <EditRow
                            value={s.name}
                            onSave={name => updateSourceMutation.mutate({ id: s.id, name })}
                            onDelete={() => deleteSourceMutation.mutate(s.id)}
                            onCancel={() => setEditingSourceId(null)}
                            saving={updateSourceMutation.isPending}
                            deleting={deleteSourceMutation.isPending}
                          />
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-2">{s.name}</td>
                          <td className="px-4 py-2 text-muted-foreground">{formatDate(s.createdAt)}</td>
                          <td className="px-4 py-2 text-right">
                            {isOwn ? (
                              <Button size="sm" variant="ghost" onClick={() => setEditingSourceId(s.id)}>
                                <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground px-2">Student</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
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
              <SelectTrigger><SelectValue placeholder="Select source…" /></SelectTrigger>
              <SelectContent>{sources.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            {sources.length === 0 && <p className="text-xs text-muted-foreground">Create a source first before adding a class.</p>}
            <div className="flex gap-2">
              <Input placeholder="e.g. Class 101" value={className} onChange={e => setClassName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && className.trim() && classSourceId) createClassMutation.mutate({ name: className, sourceId: Number(classSourceId) }); }} autoFocus />
              <Button onClick={() => createClassMutation.mutate({ name: className, sourceId: Number(classSourceId) })}
                disabled={!className.trim() || !classSourceId || createClassMutation.isPending}>
                {createClassMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => { setClassForm("hidden"); setClassName(""); setClassSourceId(""); }}>Cancel</Button>
            </div>
          </Card>
        )}

        {classForm === "success" && (
          <Card className="p-4 flex items-center justify-between bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <span className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400"><Check className="w-4 h-4" /> Class created!</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setClassForm("open")}>Create another class</Button>
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
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {sortedClasses(classes).map(c => {
                  const isOwn = c.userId === (user as any)?.id;
                  return (
                    <tr key={c.id} className="border-t">
                      {editingClassId === c.id ? (
                        <td colSpan={4} className="px-4 py-1">
                          <EditRow
                            value={c.name}
                            onSave={name => updateClassMutation.mutate({ id: c.id, name })}
                            onDelete={() => deleteClassMutation.mutate(c.id)}
                            onCancel={() => setEditingClassId(null)}
                            saving={updateClassMutation.isPending}
                            deleting={deleteClassMutation.isPending}
                          />
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-2">{c.name}</td>
                          <td className="px-4 py-2 text-muted-foreground">{c.sourceName}</td>
                          <td className="px-4 py-2 text-muted-foreground">{formatDate(c.createdAt)}</td>
                          <td className="px-4 py-2 text-right">
                            {isOwn ? (
                              <Button size="sm" variant="ghost" onClick={() => setEditingClassId(c.id)}>
                                <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground px-2">Student</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
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
            <Button onClick={() => setLessonForm("open")} variant="outline" size="sm"
              disabled={classes.length === 0} title={classes.length === 0 ? "Create a class first" : undefined}>
              {lessons.length === 0 ? "Create lesson" : "Create another lesson"}
            </Button>
          )}
        </div>

        {classes.length === 0 && <p className="text-sm text-muted-foreground">Create a class first to enable lesson creation.</p>}

        {lessonForm === "open" && (
          <Card className="p-4 space-y-3">
            <p className="text-sm font-medium">New lesson</p>
            <Select value={lessonClassId} onValueChange={id => { setLessonClassId(id); setCreateLessonError(""); }}>
              <SelectTrigger><SelectValue placeholder="Select class…" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name} <span className="text-muted-foreground">({c.sourceName})</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClass && <p className="text-xs text-muted-foreground">Source: <strong>{selectedClass.sourceName}</strong></p>}
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <Input placeholder="e.g. Lesson 1" value={lessonName}
                  onChange={e => { setLessonName(e.target.value); setCreateLessonError(""); }}
                  onKeyDown={e => { if (e.key === "Enter" && lessonName.trim() && selectedClass) createLessonMutation.mutate({ lesson: lessonName, classId: selectedClass.id, sourceId: selectedClass.sourceId }); }}
                  autoFocus />
                <Button onClick={() => selectedClass && createLessonMutation.mutate({ lesson: lessonName, classId: selectedClass.id, sourceId: selectedClass.sourceId })}
                  disabled={!lessonName.trim() || !lessonClassId || createLessonMutation.isPending}>
                  {createLessonMutation.isPending ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" onClick={() => { setLessonForm("hidden"); setLessonName(""); setLessonClassId(""); setCreateLessonError(""); }}>Cancel</Button>
              </div>
              {createLessonError && <p className="text-xs text-destructive">{createLessonError}</p>}
            </div>
          </Card>
        )}

        {lessonForm === "success" && (
          <Card className="p-4 flex items-center justify-between bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <span className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400"><Check className="w-4 h-4" /> Lesson created!</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setLessonForm("open")}>Create another lesson</Button>
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
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {sortedLessons(lessons).map(l => {
                  const isOwn = l.userId === (user as any)?.id;
                  return (
                  <tr key={l.id} className="border-t">
                    {editingLessonId === l.id ? (
                      <td colSpan={5} className="px-4 py-1">
                        <EditRow
                          value={l.lesson}
                          onSave={lesson => { setEditLessonError(""); updateLessonMutation.mutate({ id: l.id, lesson }); }}
                          onDelete={() => deleteLessonMutation.mutate(l.id)}
                          onCancel={() => { setEditingLessonId(null); setEditLessonError(""); }}
                          saving={updateLessonMutation.isPending}
                          deleting={deleteLessonMutation.isPending}
                          error={editLessonError}
                        />
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-2">{l.lesson}</td>
                        <td className="px-4 py-2">{l.className}</td>
                        <td className="px-4 py-2 text-muted-foreground">{l.sourceName}</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(l.createdAt)}</td>
                        <td className="px-4 py-2 text-right">
                          {isOwn ? (
                            <Button size="sm" variant="ghost" onClick={() => { setEditingLessonId(l.id); setEditLessonError(""); }}>
                              <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground px-2">Student</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Match characters ─────────────────────────────────────────────── */}
      <section className="pt-2 border-t">
        <Button onClick={() => setLocation("/customize/match")}
          className={cn("gap-2", lessons.length === 0 && "opacity-50")}
          disabled={lessons.length === 0} title={lessons.length === 0 ? "Create a lesson first" : undefined}>
          Match characters to source
          <ChevronRight className="w-4 h-4" />
        </Button>
        {lessons.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Create at least one lesson to start matching characters.</p>}
      </section>
    </div>
  );
}
