import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BookOpen, PenTool, Grid3x3 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProgressFilterProps {
  filterReading: boolean;
  filterWriting: boolean;
  filterRadical: boolean;
  onToggleFilterReading: () => void;
  onToggleFilterWriting: () => void;
  onToggleFilterRadical: () => void;
  selectedHskLevels: number[];
  onToggleHskLevel: (level: number) => void;
  sources?: { id: number; name: string }[];
  classes?: { id: number; name: string; sourceId: number }[];
  lessons?: { id: number; lesson: string; classId: number }[];
  selectedSourceId?: number | null;
  selectedClassId?: number | null;
  selectedLessonId?: number | null;
  filterCore?: boolean;
  filterOther?: boolean;
  onSelectSource?: (id: number | null) => void;
  onSelectClass?: (id: number | null) => void;
  onSelectLesson?: (id: number | null) => void;
  onToggleFilterCore?: () => void;
  onToggleFilterOther?: () => void;
}

export default function ProgressFilter({
  filterReading,
  filterWriting,
  filterRadical,
  onToggleFilterReading,
  onToggleFilterWriting,
  onToggleFilterRadical,
  selectedHskLevels,
  onToggleHskLevel,
  sources = [],
  classes = [],
  lessons = [],
  selectedSourceId = null,
  selectedClassId = null,
  selectedLessonId = null,
  filterCore = false,
  filterOther = false,
  onSelectSource = () => {},
  onSelectClass = () => {},
  onSelectLesson = () => {},
  onToggleFilterCore = () => {},
  onToggleFilterOther = () => {},
}: ProgressFilterProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="text-sm font-medium">Show only not mastered:</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="filter-reading"
              checked={filterReading}
              onCheckedChange={onToggleFilterReading}
              data-testid="checkbox-filter-reading"
            />
            <Label
              htmlFor="filter-reading"
              className="flex items-center gap-2 text-sm font-normal cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-green-600" />
              Reading
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="filter-writing"
              checked={filterWriting}
              onCheckedChange={onToggleFilterWriting}
              data-testid="checkbox-filter-writing"
            />
            <Label
              htmlFor="filter-writing"
              className="flex items-center gap-2 text-sm font-normal cursor-pointer"
            >
              <PenTool className="w-4 h-4 text-green-600" />
              Writing
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="filter-radical"
              checked={filterRadical}
              onCheckedChange={onToggleFilterRadical}
              data-testid="checkbox-filter-radical"
            />
            <Label
              htmlFor="filter-radical"
              className="flex items-center gap-2 text-sm font-normal cursor-pointer"
            >
              <Grid3x3 className="w-4 h-4 text-green-600" />
              Radical
            </Label>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-sm font-medium">Filter by HSK Level:</Label>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((level) => (
            <div key={level} className="flex items-center space-x-2">
              <Checkbox
                id={`hsk-level-${level}`}
                checked={selectedHskLevels.includes(level)}
                onCheckedChange={() => onToggleHskLevel(level)}
                data-testid={`checkbox-hsk-${level}`}
              />
              <Label
                htmlFor={`hsk-level-${level}`}
                className="text-sm font-normal cursor-pointer"
              >
                {level === 0 ? "Unknown" : `HSK ${level}`}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-sm font-medium">Filter by Lesson:</Label>

        <Select
          value={selectedSourceId ? String(selectedSourceId) : ""}
          onValueChange={v => onSelectSource(v ? Number(v) : null)}
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
          onValueChange={v => onSelectClass(v ? Number(v) : null)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Class…" />
          </SelectTrigger>
          <SelectContent>
            {classes.filter(c => c.sourceId === selectedSourceId).map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={!selectedClassId}
          value={selectedLessonId ? String(selectedLessonId) : ""}
          onValueChange={v => onSelectLesson(v ? Number(v) : null)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Lesson…" />
          </SelectTrigger>
          <SelectContent>
            {lessons.filter(l => l.classId === selectedClassId).map(l => (
              <SelectItem key={l.id} value={String(l.id)}>{l.lesson}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedLessonId && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="filter-core"
                checked={filterCore}
                onCheckedChange={onToggleFilterCore}
              />
              <Label htmlFor="filter-core" className="text-sm font-normal cursor-pointer">
                Core
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="filter-other"
                checked={filterOther}
                onCheckedChange={onToggleFilterOther}
              />
              <Label htmlFor="filter-other" className="text-sm font-normal cursor-pointer">
                Other
              </Label>
            </div>
          </div>
        )}

        {selectedSourceId && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => { onSelectSource(null); onSelectClass(null); onSelectLesson(null); }}
          >
            Clear lesson filter
          </Button>
        )}
      </div>
    </div>
  );
}
