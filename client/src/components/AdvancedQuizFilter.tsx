import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tag } from "lucide-react";
import type { AdvancedQuizFilter } from "./quizTypes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filter: AdvancedQuizFilter | null) => void;
  current: AdvancedQuizFilter | null;
}

export default function AdvancedQuizFilterDialog({ open, onOpenChange, onApply, current }: Props) {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(current?.tagId ?? null);

  const { data: sources = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/sources"],
  });
  const { data: allClasses = [] } = useQuery<{ id: number; name: string; sourceId: number }[]>({
    queryKey: ["/api/classes"],
  });
  const { data: allLessons = [] } = useQuery<{ id: number; lesson: string; classId: number }[]>({
    queryKey: ["/api/lessons"],
  });
  const { data: tags = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/tags"],
  });

  function buildDescription(): string {
    const parts: string[] = [];
    if (selectedLessonId) {
      const lesson = allLessons.find(l => l.id === selectedLessonId);
      const cls = allClasses.find(c => c.id === selectedClassId);
      const src = sources.find(s => s.id === selectedSourceId);
      if (src) parts.push(src.name);
      if (cls) parts.push(cls.name);
      if (lesson) parts.push(`Lesson ${lesson.lesson}`);
    }
    if (selectedTagId) {
      const tag = tags.find(t => t.id === selectedTagId);
      if (tag) parts.push(`#${tag.name}`);
    }
    return parts.join(" › ") || "Advanced selection";
  }

  function handleApply() {
    if (!selectedLessonId && !selectedTagId) {
      onApply(null);
    } else {
      onApply({
        lessonId: selectedLessonId ?? undefined,
        tagId: selectedTagId ?? undefined,
        description: buildDescription(),
      });
    }
    onOpenChange(false);
  }

  function handleClear() {
    setSelectedSourceId(null);
    setSelectedClassId(null);
    setSelectedLessonId(null);
    setSelectedTagId(null);
    onApply(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Advanced selection</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose characters from a specific lesson or tag. Questions will be drawn from that set.
          </p>

          {/* Source / Class / Lesson cascade */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Lesson:</Label>
            <Select
              value={selectedSourceId ? String(selectedSourceId) : ""}
              onValueChange={v => {
                const id = v ? Number(v) : null;
                setSelectedSourceId(id);
                setSelectedClassId(null);
                setSelectedLessonId(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Source…" />
              </SelectTrigger>
              <SelectContent>
                {sources.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              disabled={!selectedSourceId}
              value={selectedClassId ? String(selectedClassId) : ""}
              onValueChange={v => {
                const id = v ? Number(v) : null;
                setSelectedClassId(id);
                setSelectedLessonId(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Class…" />
              </SelectTrigger>
              <SelectContent>
                {allClasses.filter(c => c.sourceId === selectedSourceId).map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              disabled={!selectedClassId}
              value={selectedLessonId ? String(selectedLessonId) : ""}
              onValueChange={v => setSelectedLessonId(v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Lesson…" />
              </SelectTrigger>
              <SelectContent>
                {allLessons.filter(l => l.classId === selectedClassId).map(l => (
                  <SelectItem key={l.id} value={String(l.id)}>{l.lesson}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tag filter */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Tag:
              </Label>
              <Select
                value={selectedTagId ? String(selectedTagId) : ""}
                onValueChange={v => setSelectedTagId(v ? Number(v) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any tag…" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {current && (
            <Button variant="outline" onClick={handleClear} className="mr-auto">
              Clear
            </Button>
          )}
          <Button
            onClick={handleApply}
            disabled={!selectedLessonId && !selectedTagId}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
