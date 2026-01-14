import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface SettingsPanelProps {
  currentLevel: number;
  dailyCharCount: number;
  standardModePageSize?: number;
  onLevelChange: (level: number) => void;
  onDailyCharCountChange: (count: number) => void;
  onStandardModePageSizeChange?: (size: number) => void;
}

export default function SettingsPanel({
  currentLevel,
  dailyCharCount,
  standardModePageSize = 20,
  onLevelChange,
  onDailyCharCountChange,
  onStandardModePageSizeChange,
}: SettingsPanelProps) {
  const [tempLevel, setTempLevel] = useState(currentLevel.toString());
  const [tempDailyCount, setTempDailyCount] = useState(dailyCharCount.toString());
  const [tempPageSize, setTempPageSize] = useState(standardModePageSize.toString());

  const handleLevelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = parseInt(tempLevel) || 0;
      onLevelChange(Math.max(0, Math.min(3000, val)));
    }
  };

  const handleLevelBlur = () => {
    const val = parseInt(tempLevel) || 0;
    const clampedVal = Math.max(0, Math.min(3000, val));
    setTempLevel(clampedVal.toString());
    if (clampedVal !== currentLevel) {
      onLevelChange(clampedVal);
    }
  };

  const handleDailyCountBlur = () => {
    const val = parseInt(tempDailyCount) || 1;
    const clampedVal = Math.max(1, Math.min(50, val));
    setTempDailyCount(clampedVal.toString());
    if (clampedVal !== dailyCharCount) {
      onDailyCharCountChange(clampedVal);
    }
  };

  const handlePageSizeBlur = () => {
    const val = parseInt(tempPageSize) || 20;
    const clampedVal = Math.max(10, Math.min(100, val));
    setTempPageSize(clampedVal.toString());
    if (clampedVal !== standardModePageSize && onStandardModePageSizeChange) {
      onStandardModePageSizeChange(clampedVal);
    }
  };

  // Update temp values when props change
  useEffect(() => {
    setTempDailyCount(dailyCharCount.toString());
  }, [dailyCharCount]);

  useEffect(() => {
    setTempPageSize(standardModePageSize.toString());
  }, [standardModePageSize]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="current-level">Reading mastered</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" data-testid="help-reading-mastered" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>This is the character index of the characters shown on the <em>Daily</em> view. This level will automatically progress to the next character that has not yet been fully mastered.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Input
          id="current-level"
          type="number"
          min="0"
          max="3000"
          value={tempLevel}
          onChange={(e) => setTempLevel(e.target.value)}
          onKeyDown={handleLevelKeyDown}
          onBlur={handleLevelBlur}
          data-testid="input-level"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="daily-chars">Daily characters</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" data-testid="help-daily-characters" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>This is the number of characters shown on the <em>Daily</em> view.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Input
          id="daily-chars"
          type="number"
          min="1"
          max="50"
          value={tempDailyCount}
          onChange={(e) => setTempDailyCount(e.target.value)}
          onBlur={handleDailyCountBlur}
          data-testid="input-daily-chars"
        />
      </div>

      {onStandardModePageSizeChange && (
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Label htmlFor="standard-page-size">Standard mode page size</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" data-testid="help-page-size" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>This indicates the number of characters shown per page. More characters will result in more loading time, but less frequent refreshing.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            id="standard-page-size"
            type="number"
            min="10"
            max="100"
            step="5"
            value={tempPageSize}
            onChange={(e) => setTempPageSize(e.target.value)}
            onBlur={handlePageSizeBlur}
            data-testid="input-standard-page-size"
          />
        </div>
      )}
    </div>
  );
}
