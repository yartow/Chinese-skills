import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, authenticatedFetch } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, ChevronLeft, ChevronRight, ClipboardList, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import type { ActivityLog, User } from "@shared/schema";

type SafeUser = Omit<User, "passwordHash"> & { status?: string };

interface ProgressHistoryEntry {
  characterIndex: number;
  simplified: string;
  skills: string[];
}
interface ProgressHistoryByDate {
  date: string;
  gained: ProgressHistoryEntry[];
  lost: ProgressHistoryEntry[];
}

function formatMinutes(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function last30Days(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(from), to: fmt(to) };
}

function shortDate(date: string) {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function ActivityChart({ logs }: { logs: ActivityLog[] }) {
  const byDate = new Map<string, { standard: number; test: number }>();
  for (const log of logs) {
    const row = byDate.get(log.date) ?? { standard: 0, test: 0 };
    if (log.view === "standard") row.standard += log.seconds;
    if (log.view === "test") row.test += log.seconds;
    byDate.set(log.date, row);
  }
  const data = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { standard, test }]) => ({
      date: shortDate(date),
      Standard: Math.round(standard / 60),
      Test: Math.round(test / 60),
    }));

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit="m" />
        <Tooltip formatter={(v: number) => `${v}m`} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Standard" fill="#6366f1" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Test" fill="#a855f7" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ActivityTable({ logs }: { logs: ActivityLog[] }) {
  const byDate = new Map<string, { standard: number; test: number }>();
  for (const log of logs) {
    const row = byDate.get(log.date) ?? { standard: 0, test: 0 };
    if (log.view === "standard") row.standard += log.seconds;
    if (log.view === "test") row.test += log.seconds;
    byDate.set(log.date, row);
  }
  const rows = Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No activity recorded yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-muted-foreground">
          <th className="text-left py-2 font-medium">Date</th>
          <th className="text-right py-2 font-medium">Standard</th>
          <th className="text-right py-2 font-medium">Test</th>
          <th className="text-right py-2 font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([date, { standard, test }]) => (
          <tr key={date} className="border-b last:border-0">
            <td className="py-2">{date}</td>
            <td className="py-2 text-right">{standard > 0 ? formatMinutes(standard) : "—"}</td>
            <td className="py-2 text-right">{test > 0 ? formatMinutes(test) : "—"}</td>
            <td className="py-2 text-right font-medium">{formatMinutes(standard + test)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProgressChart({ history }: { history: ProgressHistoryByDate[] }) {
  const data = history.map(({ date, gained, lost }) => ({
    date: shortDate(date),
    Gained: gained.reduce((n, e) => n + e.skills.length, 0),
    Lost: lost.reduce((n, e) => n + e.skills.length, 0),
  }));

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Gained" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill="#22c55e" />)}
        </Bar>
        <Bar dataKey="Lost" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill="#ef4444" />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const SKILL_LABEL: Record<string, string> = { reading: "Reading", writing: "Writing", radical: "Radical" };

function ProgressTable({ history }: { history: ProgressHistoryByDate[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (date: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });

  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No mastery changes recorded yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-muted-foreground">
          <th className="text-left py-2 font-medium w-8" />
          <th className="text-left py-2 font-medium">Date</th>
          <th className="text-right py-2 font-medium text-green-600">Gained</th>
          <th className="text-right py-2 font-medium text-red-500">Lost</th>
        </tr>
      </thead>
      <tbody>
        {[...history].reverse().map(({ date, gained, lost }) => {
          const gainedCount = gained.reduce((n, e) => n + e.skills.length, 0);
          const lostCount = lost.reduce((n, e) => n + e.skills.length, 0);
          const isOpen = expanded.has(date);
          return (
            <>
              <tr
                key={date}
                className="border-b cursor-pointer hover:bg-muted/40"
                onClick={() => toggle(date)}
              >
                <td className="py-2 pl-1">
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </td>
                <td className="py-2 font-medium">{date}</td>
                <td className="py-2 text-right text-green-600 font-medium">
                  {gainedCount > 0 ? `+${gainedCount}` : "—"}
                </td>
                <td className="py-2 text-right text-red-500 font-medium">
                  {lostCount > 0 ? `-${lostCount}` : "—"}
                </td>
              </tr>
              {isOpen && (
                <tr key={`${date}-detail`} className="border-b bg-muted/20">
                  <td colSpan={4} className="px-4 py-3">
                    <div className="space-y-2">
                      {gained.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-green-700 mb-1">Gained</p>
                          <div className="flex flex-wrap gap-2">
                            {gained.map(e => (
                              <span key={e.characterIndex} className="inline-flex items-center gap-1 rounded-md bg-green-50 border border-green-200 px-2 py-0.5 text-xs">
                                <span className="text-base leading-none">{e.simplified}</span>
                                <span className="text-muted-foreground">{e.skills.map(s => SKILL_LABEL[s]).join(", ")}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {lost.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-red-600 mb-1">Lost</p>
                          <div className="flex flex-wrap gap-2">
                            {lost.map(e => (
                              <span key={e.characterIndex} className="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-xs">
                                <span className="text-base leading-none">{e.simplified}</span>
                                <span className="text-muted-foreground">{e.skills.map(s => SKILL_LABEL[s]).join(", ")}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </>
          );
        })}
      </tbody>
    </table>
  );
}

function StudentDetail({ student, onBack }: { student: SafeUser; onBack: () => void }) {
  const { from, to } = last30Days();

  const { data: logs = [], isLoading: activityLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/teacher/students", student.id, "activity", from, to],
    queryFn: async () => {
      const res = await authenticatedFetch(
        `/api/teacher/students/${student.id}/activity?from=${from}&to=${to}`
      );
      return res.json();
    },
    staleTime: 0,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<ProgressHistoryByDate[]>({
    queryKey: ["/api/teacher/students", student.id, "progress-history", from, to],
    queryFn: async () => {
      const res = await authenticatedFetch(
        `/api/teacher/students/${student.id}/progress-history?from=${from}&to=${to}`
      );
      return res.json();
    },
    staleTime: 0,
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
        <ChevronLeft className="w-4 h-4" /> Back
      </Button>
      <div>
        <h2 className="text-xl font-semibold">
          {student.firstName ?? student.email}
          {student.lastName ? ` ${student.lastName}` : ""}
        </h2>
        <p className="text-sm text-muted-foreground">{student.email}</p>
      </div>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Time spent — last 30 days</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activityLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <ActivityChart logs={logs} />
                  <ActivityTable logs={logs} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mastery changes — last 30 days</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {historyLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <ProgressChart history={history} />
                  <ProgressTable history={history} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function TeacherPage() {
  const [, setLocation] = useLocation();
  const [selectedStudent, setSelectedStudent] = useState<SafeUser | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [addError, setAddError] = useState("");

  const { data: students = [], isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/teacher/students"],
    queryFn: async () => {
      const res = await authenticatedFetch("/api/teacher/students");
      return res.json();
    },
    staleTime: 0,
  });

  const addMutation = useMutation({
    mutationFn: (email: string) => apiRequest("POST", "/api/teacher/students", { email }),
    onSuccess: () => {
      setEmailInput("");
      setAddError("");
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/students"] });
    },
    onError: async (err: any) => {
      const text = err?.message ?? "Failed to add student";
      setAddError(text.replace(/^\d+:\s*/, ""));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (studentId: string) =>
      apiRequest("DELETE", `/api/teacher/students/${studentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/students"] });
    },
  });

  if (selectedStudent) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <StudentDetail student={selectedStudent} onBack={() => setSelectedStudent(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Students</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add student</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="student@email.com"
              value={emailInput}
              onChange={(e) => { setEmailInput(e.target.value); setAddError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" && emailInput) addMutation.mutate(emailInput); }}
            />
            <Button
              onClick={() => addMutation.mutate(emailInput)}
              disabled={!emailInput || addMutation.isPending}
            >
              Add
            </Button>
          </div>
          {addError && <p className="text-sm text-destructive mt-2">{addError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : students.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No students yet. Add one above.</p>
          ) : (
            <ul className="divide-y">
              {students.map((s) => {
                const isPending = s.status === "pending";
                return (
                  <li key={s.id} className="flex items-center justify-between py-3">
                    <button
                      className={`text-left flex-1 ${isPending ? "opacity-60 cursor-default" : "hover:underline"}`}
                      onClick={() => { if (!isPending) setSelectedStudent(s); }}
                      disabled={isPending}
                    >
                      <span className="font-medium">
                        {s.firstName ?? s.email}
                        {s.lastName ? ` ${s.lastName}` : ""}
                      </span>
                      {s.firstName && (
                        <span className="text-sm text-muted-foreground ml-2">{s.email}</span>
                      )}
                      {isPending ? (
                        <span className="ml-2 text-xs text-amber-600 font-medium">awaiting approval</span>
                      ) : (
                        <ChevronRight className="w-4 h-4 inline ml-1 text-muted-foreground" />
                      )}
                    </button>
                    {!isPending && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLocation(`/checkup/create?student=${s.id}`)}
                        title="Create check-up"
                      >
                        <ClipboardList className="w-4 h-4 text-primary" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMutation.mutate(s.id)}
                      disabled={removeMutation.isPending}
                      aria-label="Remove student"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
