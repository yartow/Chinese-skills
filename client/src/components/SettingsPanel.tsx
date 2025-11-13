import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface SettingsPanelProps {
  currentLevel: number;
  dailyCharCount: number;
  onLevelChange: (level: number) => void;
  onDailyCharCountChange: (count: number) => void;
}

export default function SettingsPanel({
  currentLevel,
  dailyCharCount,
  onLevelChange,
  onDailyCharCountChange,
}: SettingsPanelProps) {
  const [tempLevel, setTempLevel] = useState(currentLevel.toString());

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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="current-level">Current Level (0-3000)</Label>
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="daily-chars">Daily Characters</Label>
          <span className="text-sm text-muted-foreground" data-testid="text-daily-count">
            {dailyCharCount}
          </span>
        </div>
        <Slider
          id="daily-chars"
          min={1}
          max={50}
          step={1}
          value={[dailyCharCount]}
          onValueChange={([value]) => onDailyCharCountChange(value)}
          data-testid="slider-daily-chars"
        />
      </div>
    </div>
  );
}
