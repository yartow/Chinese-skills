import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, authenticatedFetch } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { useLocation } from "wouter";
import type { ActivityLog, User } from "@shared/schema";

type SafeUser = Omit<User, "passwordHash"> & { status?: string };

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

function StudentDetail({ student, onBack }: { student: SafeUser; onBack: () => void }) {
  const { from, to } = last30Days();
  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/teacher/students", student.id, "activity", from, to],
    queryFn: async () => {
      const res = await authenticatedFetch(
        `/api/teacher/students/${student.id}/activity?from=${from}&to=${to}`
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
      <h2 className="text-xl font-semibold">
        {student.firstName ?? student.email}
        {student.lastName ? ` ${student.lastName}` : ""}
      </h2>
      <p className="text-sm text-muted-foreground">{student.email}</p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity — last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ActivityTable logs={logs} />
          )}
        </CardContent>
      </Card>
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
