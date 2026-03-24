import { useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Download, Upload } from "lucide-react";

interface SettingsPanelProps {
  currentLevel: number;
  dailyCharCount: number;
  standardModePageSize?: number;
  useAiFeedback?: boolean;
  useAiSentences?: boolean;
  onLevelChange: (level: number) => void;
  onDailyCharCountChange: (count: number) => void;
  onStandardModePageSizeChange?: (size: number) => void;
  onUseAiFeedbackChange?: (value: boolean) => void;
  onUseAiSentencesChange?: (value: boolean) => void;
}

export default function SettingsPanel({
  currentLevel,
  dailyCharCount,
  standardModePageSize = 20,
  useAiFeedback = false,
  useAiSentences = false,
  onLevelChange,
  onDailyCharCountChange,
  onStandardModePageSizeChange,
  onUseAiFeedbackChange,
  onUseAiSentencesChange,
}: SettingsPanelProps) {
  const [tempLevel, setTempLevel] = useState(currentLevel.toString());
  const [tempDailyCount, setTempDailyCount] = useState(dailyCharCount.toString());
  const [tempPageSize, setTempPageSize] = useState(standardModePageSize.toString());
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/admin/characters/export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "chinese_characters.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed. Please try again.";
      setImportStatus({ type: "error", message: msg });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/characters/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Import failed");
      setImportStatus({
        type: "success",
        message: `Updated ${data.updated} characters (${data.skipped} skipped, ${data.total} total rows).`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed. Please check the file and try again.";
      setImportStatus({ type: "error", message: msg });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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

      {onUseAiFeedbackChange && (
        <div className="flex items-start justify-between gap-4 py-1">
          <div className="space-y-0.5">
            <Label htmlFor="ai-feedback-toggle" className="text-sm">Fresh AI feedback in quiz</Label>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              Always generate a new explanation via Claude when you submit an answer. When off, cached explanations are used (faster, no extra API cost).
            </p>
          </div>
          <Switch
            id="ai-feedback-toggle"
            checked={useAiFeedback}
            onCheckedChange={onUseAiFeedbackChange}
            data-testid="toggle-ai-feedback"
          />
        </div>
      )}

      {onUseAiSentencesChange && (
        <div className="flex items-start justify-between gap-4 py-1">
          <div className="space-y-0.5">
            <Label htmlFor="ai-sentences-toggle" className="text-sm">AI-generated quiz sentences</Label>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              Use Claude to generate example sentences for quiz questions. Generated sentences are stored and reused, so the API is only called once per character.
            </p>
          </div>
          <Switch
            id="ai-sentences-toggle"
            checked={useAiSentences}
            onCheckedChange={onUseAiSentencesChange}
            data-testid="toggle-ai-sentences"
          />
        </div>
      )}

      <div className="space-y-3 pt-2 border-t">
        <Label className="text-sm font-semibold">Admin</Label>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Download all characters as an Excel file. Edit the <strong>lesson</strong> column (and other fields), then upload the file to apply changes.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              data-testid="button-export-excel"
            >
              <Download className="h-4 w-4 mr-1" />
              {isExporting ? "Exporting…" : "Export to Excel"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              data-testid="button-import-excel"
            >
              <Upload className="h-4 w-4 mr-1" />
              {isImporting ? "Importing…" : "Import from Excel"}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
            data-testid="input-import-file"
          />
          {importStatus && (
            <p
              className={`text-xs ${importStatus.type === "success" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
              data-testid="text-import-status"
            >
              {importStatus.message}
            </p>
          )}
        </div>

        <div className="rounded-md border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            You can export the full set of Chinese characters, edit them and even add new characters by importing them back into the application. Only the changes you have made will be added to the database.
          </p>
        </div>
      </div>
    </div>
  );
}
