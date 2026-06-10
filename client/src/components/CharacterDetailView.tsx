import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, PenTool, Grid3x3, Heart, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import ScriptToggle from "./ScriptToggle";
import StrokeOrder from "./StrokeOrder";

interface ExampleSentence {
  chinese: string;
  english: string;
}

interface WordExample {
  word: string;
  pinyin: string;
  meaning?: string;
  definition?: string;
  chinese?: string;
  english?: string;
}

type ExampleSentences = ExampleSentence[] | null | undefined;
type WordExamples = WordExample[] | null | undefined;

interface SavePayload {
  type: string;
  chinese: string;
  pinyin: string;
  english: string;
}

interface CharacterDetailViewProps {
  character: {
    simplified: string;
    traditional: string;
    pinyin: string;
    pinyin2?: string | null;
    pinyin3?: string | null;
    radical?: string | null;
    radicalTraditional?: string | null;
    radicalPinyin?: string | null;
    radicalPinyinTraditional?: string | null;
    definition: string[];
    examples: ExampleSentence[];
    examplesTraditional?: ExampleSentences;
    wordExamples?: WordExamples;
    wordExamplesTraditional?: WordExamples;
  };
  index?: number;
  hskLevel?: number;
  progress: {
    reading: boolean;
    writing: boolean;
    radical: boolean;
  };
  savedChinese: Set<string>;
  onToggleSave: (item: SavePayload) => void;
  onBack: () => void;
  isTraditional: boolean;
  onToggleScript: (isTraditional: boolean) => void;
  onToggleReading: () => void;
  onToggleWriting: () => void;
  onToggleRadical: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onReport: (explanation: string) => Promise<void>;
}

export default function CharacterDetailView({
  character,
  index,
  hskLevel,
  progress,
  savedChinese,
  onToggleSave,
  onBack,
  isTraditional,
  onToggleScript,
  onToggleReading,
  onToggleWriting,
  onToggleRadical,
  onPrevious,
  onNext,
  onReport,
}: CharacterDetailViewProps) {
  const [showAllExamples, setShowAllExamples] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  async function handleReportSubmit() {
    if (!reportText.trim()) return;
    setReportSubmitting(true);
    setReportError(null);
    try {
      await onReport(reportText.trim());
      setReportSent(true);
      setReportText("");
    } catch {
      setReportError("Failed to submit report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  }

  function handleReportOpenChange(open: boolean) {
    setReportOpen(open);
    if (!open) {
      setReportSent(false);
      setReportError(null);
      setReportText("");
    }
  }
  const displayChar = isTraditional ? character.traditional : character.simplified;

  // Use traditional variants when toggle is on and data is available, else fall back to simplified
  const displayRadical = isTraditional
    ? (character.radicalTraditional ?? character.radical)
    : character.radical;
  const displayRadicalPinyin = isTraditional
    ? (character.radicalPinyinTraditional ?? character.radicalPinyin)
    : character.radicalPinyin;
  const activeExamples: ExampleSentence[] = (isTraditional && character.examplesTraditional?.length)
    ? (character.examplesTraditional as ExampleSentence[])
    : character.examples;
  const activeWordExamples: WordExample[] | undefined = (isTraditional && character.wordExamplesTraditional?.length)
    ? (character.wordExamplesTraditional as WordExample[])
    : (character.wordExamples as WordExample[] | undefined);
  const displayedExamples = showAllExamples ? activeExamples : activeExamples.slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button
            variant="ghost"
            onClick={onBack}
            className="gap-2 shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex items-center gap-2 shrink-0">
            {onPrevious && (
              <Button
                variant="outline"
                size="icon"
                onClick={onPrevious}
                data-testid="button-previous-char"
                title="Previous character"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {onNext && (
              <Button
                variant="outline"
                size="icon"
                onClick={onNext}
                data-testid="button-next-char"
                title="Next character"
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
            <ScriptToggle isTraditional={isTraditional} onToggle={onToggleScript} />
          </div>
        </div>

        <div className="text-center space-y-6">
          <div className="relative inline-block">
            <div className="text-[12rem] font-chinese leading-none" data-testid="text-character-large">
              {displayChar}
            </div>
            {index !== undefined && (
              <span
                className="absolute top-2 right-0 translate-x-full pl-2 text-sm text-muted-foreground font-mono"
                data-testid="text-character-index"
              >
                #{index}
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onToggleReading}
              className="flex flex-col items-center gap-1 p-2 rounded hover-elevate active-elevate-2"
              data-testid="button-toggle-reading"
            >
              <BookOpen
                className={`w-6 h-6 ${progress.reading ? "text-green-600" : "text-gray-400"}`}
              />
              <span className="text-xs text-muted-foreground">Reading</span>
            </button>
            <button
              onClick={onToggleWriting}
              className="flex flex-col items-center gap-1 p-2 rounded hover-elevate active-elevate-2"
              data-testid="button-toggle-writing"
            >
              <PenTool
                className={`w-6 h-6 ${progress.writing ? "text-green-600" : "text-gray-400"}`}
              />
              <span className="text-xs text-muted-foreground">Writing</span>
            </button>
            <button
              onClick={onToggleRadical}
              className="flex flex-col items-center gap-1 p-2 rounded hover-elevate active-elevate-2"
              data-testid="button-toggle-radical"
            >
              <Grid3x3
                className={`w-6 h-6 ${progress.radical ? "text-green-600" : "text-gray-400"}`}
              />
              <span className="text-xs text-muted-foreground">Radical</span>
            </button>
          </div>
        </div>

        <Card className="p-6 space-y-6">
          {hskLevel !== undefined && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">HSK Level</h3>
              <p className="text-2xl font-semibold" data-testid="text-hsk-level">HSK {hskLevel}</p>
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Pinyin</h3>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="text-3xl font-semibold" data-testid="text-pinyin">{character.pinyin}</p>
              {character.pinyin2 && (
                <p className="text-2xl text-muted-foreground" data-testid="text-pinyin2">{character.pinyin2}</p>
              )}
              {character.pinyin3 && (
                <p className="text-2xl text-muted-foreground" data-testid="text-pinyin3">{character.pinyin3}</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Radical</h3>
            <div className="flex items-center gap-4">
              <span className="text-4xl font-chinese" data-testid="text-radical">{displayRadical}</span>
              <span className="text-xl text-muted-foreground" data-testid="text-radical-pinyin">({displayRadicalPinyin})</span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Definition</h3>
            <ul className="list-disc list-inside space-y-1">
              {character.definition.map((def, index) => (
                <li key={index} className="text-base" data-testid={`text-definition-${index}`}>
                  {def}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Stroke Order</h3>
          <StrokeOrder character={displayChar} />
        </Card>

        {activeWordExamples && activeWordExamples.length > 0 && (
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Word Examples</h3>
            <div className="space-y-4">
              {activeWordExamples.map((we, index) => (
                <div key={index} className="space-y-1" data-testid={`word-example-${index}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                      <span className="text-2xl font-chinese" data-testid={`text-word-example-word-${index}`}>{we.word}</span>
                      <span className="text-base text-muted-foreground" data-testid={`text-word-example-pinyin-${index}`}>{we.pinyin}</span>
                      <span className="text-base text-muted-foreground">—</span>
                      <span className="text-base" data-testid={`text-word-example-definition-${index}`}>{we.meaning ?? we.definition}</span>
                    </div>
                    <button
                      onClick={() => onToggleSave({ type: "word", chinese: we.word, pinyin: we.pinyin, english: we.meaning ?? we.definition ?? "" })}
                      className="shrink-0 p-1 rounded hover:bg-muted mt-1"
                      aria-label={savedChinese.has(we.word) ? "Unsave word" : "Save word"}
                    >
                      <Heart className={`w-4 h-4 ${savedChinese.has(we.word) ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                    </button>
                  </div>
                  {we.chinese && (
                    <p className="text-base font-chinese pl-1" data-testid={`text-word-example-chinese-${index}`}>{we.chinese}</p>
                  )}
                  {we.english && (
                    <p className="text-sm text-muted-foreground pl-1" data-testid={`text-word-example-english-${index}`}>{we.english}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Example Sentences</h3>
          <div className="space-y-4">
            {displayedExamples.map((example, index) => (
              <div key={index} className="space-y-1" data-testid={`example-${index}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1">
                    <p className="text-lg font-chinese" data-testid={`text-example-chinese-${index}`}>
                      {example.chinese}
                    </p>
                    <p className="text-base text-muted-foreground" data-testid={`text-example-english-${index}`}>
                      {example.english}
                    </p>
                  </div>
                  <button
                    onClick={() => onToggleSave({ type: "sentence", chinese: example.chinese, pinyin: "", english: example.english })}
                    className="shrink-0 p-1 rounded hover:bg-muted mt-1"
                    aria-label={savedChinese.has(example.chinese) ? "Unsave sentence" : "Save sentence"}
                  >
                    <Heart className={`w-4 h-4 ${savedChinese.has(example.chinese) ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {activeExamples.length > 3 && !showAllExamples && (
            <Button
              variant="outline"
              onClick={() => setShowAllExamples(true)}
              className="w-full"
              data-testid="button-show-more-examples"
            >
              Show More Examples
            </Button>
          )}
        </Card>

        <div className="flex justify-center pb-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-destructive"
            onClick={() => setReportOpen(true)}
            data-testid="button-report-character"
          >
            <Flag className="w-4 h-4" />
            Report an error
          </Button>
        </div>
      </div>

      <Dialog open={reportOpen} onOpenChange={handleReportOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report an error</DialogTitle>
          </DialogHeader>
          {reportSent ? (
            <p className="text-sm text-muted-foreground py-4">
              Thank you — your report has been submitted and will be reviewed.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Describe what is incorrect about{index !== undefined ? ` character #${index}` : ""} ({displayChar}).
              </p>
              <Textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="e.g. The pinyin is wrong, it should be ..."
                rows={4}
                maxLength={1000}
                data-testid="textarea-report"
              />
              <p className="text-xs text-muted-foreground text-right">{reportText.trim().length}/1000</p>
              {reportError && (
                <p className="text-xs text-destructive">{reportError}</p>
              )}
            </>
          )}
          <DialogFooter>
            {reportSent ? (
              <Button onClick={() => handleReportOpenChange(false)}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => handleReportOpenChange(false)} disabled={reportSubmitting}>Cancel</Button>
                <Button
                  onClick={handleReportSubmit}
                  disabled={!reportText.trim() || reportSubmitting}
                  data-testid="button-report-submit"
                >
                  {reportSubmitting ? "Submitting…" : "Submit report"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
