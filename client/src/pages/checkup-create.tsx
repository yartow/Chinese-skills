import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, authenticatedFetch } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { User } from "@shared/schema";
import type { GridType } from "@/components/WritingCanvas";

type SafeUser = Omit<User, "passwordHash">;

export default function CheckupCreatePage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const preselectedStudentId = new URLSearchParams(searchString).get("student") ?? "";

  const { data: students = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/teacher/students"],
    queryFn: async () => {
      const res = await authenticatedFetch("/api/teacher/students");
      return res.json();
    },
    staleTime: 0,
  });
  const { data: settings } = useQuery<{ maxPointsPerChar?: number }>({
    queryKey: ["/api/settings"],
    staleTime: Infinity,
  });

  const [studentId, setStudentId] = useState(preselectedStudentId);
  const [charactersInput, setCharactersInput] = useState("");
  const [displayMode, setDisplayMode] = useState<"pinyin" | "zhuyin">("pinyin");
  const [gridType, setGridType] = useState<GridType>("field");
  const [maxPoints, setMaxPoints] = useState<number | "">(""); // "" = use teacher default
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const chars = charactersInput
        .split(/[\s,，、]+/)
        .map(c => c.trim())
        .filter(c => c.length > 0);
      if (!studentId) throw new Error("Please select a student");
      if (chars.length === 0) throw new Error("Please enter at least one character");
      const res = await apiRequest("POST", "/api/checkups", {
        studentId,
        characters: chars,
        displayMode,
        gridType,
        maxPointsPerChar: maxPoints !== "" ? maxPoints : (settings?.maxPointsPerChar ?? 10),
      });
      return res.json();
    },
    onSuccess: (checkup) => {
      setLocation(`/checkup/${checkup.id}`);
    },
    onError: (err: any) => {
      setError(err?.message?.replace(/^\d+:\s*/, "") ?? "Failed to create check-up");
    },
  });

  const selectedStudent = students.find(s => s.id === studentId);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/teacher")}>← Back</Button>
        <h1 className="text-2xl font-bold">New Check-up</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Student</CardTitle></CardHeader>
        <CardContent>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
          >
            <option value="">Select a student…</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {s.firstName ? `${s.firstName}${s.lastName ? ` ${s.lastName}` : ""} (${s.email})` : s.email}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Characters to test</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="e.g. 你 好 中 国 (space, comma, or newline separated)"
            value={charactersInput}
            onChange={e => setCharactersInput(e.target.value)}
            className="font-chinese text-lg"
          />
          {charactersInput && (
            <p className="text-xs text-muted-foreground">
              {charactersInput.split(/[\s,，、]+/).filter(c => c.trim()).length} character(s)
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Display mode</CardTitle></CardHeader>
        <CardContent>
          <RadioGroup value={displayMode} onValueChange={v => setDisplayMode(v as any)} className="flex gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="pinyin" id="dm-pinyin" />
              <Label htmlFor="dm-pinyin">Pīnyīn</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="zhuyin" id="dm-zhuyin" />
              <Label htmlFor="dm-zhuyin">Zhùyīn (ㄅㄆㄇ)</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Writing grid</CardTitle></CardHeader>
        <CardContent>
          <RadioGroup value={gridType} onValueChange={v => setGridType(v as GridType)} className="flex gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="field" id="gt-field" />
              <Label htmlFor="gt-field">田字格</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="cross" id="gt-cross" />
              <Label htmlFor="gt-cross">十字格</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="blank" id="gt-blank" />
              <Label htmlFor="gt-blank">Blank</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Max points per character</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={100}
              className="w-24"
              placeholder={String(settings?.maxPointsPerChar ?? 10)}
              value={maxPoints}
              onChange={e => setMaxPoints(e.target.value === "" ? "" : parseInt(e.target.value))}
            />
            <span className="text-sm text-muted-foreground">
              leave blank to use your default ({settings?.maxPointsPerChar ?? 10})
            </span>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        className="w-full"
        disabled={createMutation.isPending || !studentId || !charactersInput.trim()}
        onClick={() => { setError(""); createMutation.mutate(); }}
      >
        {createMutation.isPending ? "Creating…" : "Create check-up & notify student"}
      </Button>
    </div>
  );
}
