import { useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BookOpen, PenTool, Grid3x3, Search, Tag } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
  // Specific characters filter
  specificCharsInput?: string;
  onSpecificCharsInputChange?: (value: string) => void;
  onSpecificCharsFilter?: () => void;
  onSpecificCharsClear?: () => void;
  appliedSpecificChars?: string;
  // Tag filter
  tags?: { id: number; name: string }[];
  selectedTagId?: number | null;
  onSelectTag?: (id: number | null) => void;
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
  specificCharsInput = "",
  onSpecificCharsInputChange = () => {},
  onSpecificCharsFilter = () => {},
  onSpecificCharsClear = () => {},
  appliedSpecificChars = "",
  tags = [],
  selectedTagId = null,
  onSelectTag = () => {},
}: ProgressFilterProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="space-y-4">
      {/* ── Specific characters ──────────────────────────────────────── */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5" />
          Specific characters:
        </Label>
        <Textarea
          ref={textareaRef}
          placeholder="Paste characters, e.g. 我妳他謝學校生"
          value={specificCharsInput}
          onChange={e => onSpecificCharsInputChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSpecificCharsFilter();
            }
          }}
          className="h-20 text-base resize-none font-serif"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={onSpecificCharsFilter}
            disabled={!specificCharsInput.trim()}
          >
            Filter
          </Button>
          {appliedSpecificChars && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSpecificCharsClear}
            >
              Clear
            </Button>
          )}
        </div>
        {appliedSpecificChars && (
          <p className="text-xs text-muted-foreground">
            Showing results for: <span className="font-serif">{appliedSpecificChars}</span>
          </p>
        )}
      </div>

      <Separator />

      {/* ── Mastery filters ──────────────────────────────────────────── */}
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

      {/* ── HSK levels ───────────────────────────────────────────────── */}
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

      {/* ── Tag filter ───────────────────────────────────────────────── */}
      {tags.length > 0 && (
        <>
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Filter by Tag:
            </Label>
            <Select
              value={selectedTagId ? String(selectedTagId) : ""}
              onValueChange={v => onSelectTag(v ? Number(v) : null)}
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
            {selectedTagId && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => onSelectTag(null)}
              >
                Clear tag filter
              </Button>
            )}
          </div>
          <Separator />
        </>
      )}

      {/* ── Lesson filter ────────────────────────────────────────────── */}
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
