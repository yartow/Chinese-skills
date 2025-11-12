import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BookOpen, PenTool, Grid3x3 } from "lucide-react";

interface ProgressFilterProps {
  filterReading: boolean;
  filterWriting: boolean;
  filterRadical: boolean;
  onToggleFilterReading: () => void;
  onToggleFilterWriting: () => void;
  onToggleFilterRadical: () => void;
}

export default function ProgressFilter({
  filterReading,
  filterWriting,
  filterRadical,
  onToggleFilterReading,
  onToggleFilterWriting,
  onToggleFilterRadical,
}: ProgressFilterProps) {
  return (
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
  );
}
