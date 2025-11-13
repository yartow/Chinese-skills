import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BookOpen, PenTool, Grid3x3 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface ProgressFilterProps {
  filterReading: boolean;
  filterWriting: boolean;
  filterRadical: boolean;
  onToggleFilterReading: () => void;
  onToggleFilterWriting: () => void;
  onToggleFilterRadical: () => void;
  selectedHskLevels: number[];
  onToggleHskLevel: (level: number) => void;
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
          {[1, 2, 3, 4, 5, 6].map((level) => (
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
                HSK {level}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
