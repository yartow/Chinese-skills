import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, PenTool, Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

interface CharacterDetailViewProps {
  character: {
    simplified: string;
    traditional: string;
    pinyin: string;
    pinyin2?: string | null;
    pinyin3?: string | null;
    radical: string;
    radicalPinyin: string;
    definition: string[];
    examples: ExampleSentence[];
    wordExamples?: WordExample[];
  };
  progress: {
    reading: boolean;
    writing: boolean;
    radical: boolean;
  };
  onBack: () => void;
  isTraditional: boolean;
  onToggleScript: (isTraditional: boolean) => void;
  onToggleReading: () => void;
  onToggleWriting: () => void;
  onToggleRadical: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export default function CharacterDetailView({
  character,
  progress,
  onBack,
  isTraditional,
  onToggleScript,
  onToggleReading,
  onToggleWriting,
  onToggleRadical,
  onPrevious,
  onNext,
}: CharacterDetailViewProps) {
  const [showAllExamples, setShowAllExamples] = useState(false);
  const displayChar = isTraditional ? character.traditional : character.simplified;
  const displayedExamples = showAllExamples ? character.examples : character.examples.slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between gap-2">
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
          <div className="text-[12rem] font-chinese leading-none" data-testid="text-character-large">
            {displayChar}
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
              <span className="text-4xl font-chinese" data-testid="text-radical">{character.radical}</span>
              <span className="text-xl text-muted-foreground" data-testid="text-radical-pinyin">({character.radicalPinyin})</span>
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

        {character.wordExamples && character.wordExamples.length > 0 && (
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Word Examples</h3>
            <div className="space-y-4">
              {character.wordExamples.map((we, index) => (
                <div key={index} className="space-y-1" data-testid={`word-example-${index}`}>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-2xl font-chinese" data-testid={`text-word-example-word-${index}`}>{we.word}</span>
                    <span className="text-base text-muted-foreground" data-testid={`text-word-example-pinyin-${index}`}>{we.pinyin}</span>
                    <span className="text-base text-muted-foreground">—</span>
                    <span className="text-base" data-testid={`text-word-example-definition-${index}`}>{we.meaning ?? we.definition}</span>
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
                <p className="text-lg font-chinese" data-testid={`text-example-chinese-${index}`}>
                  {example.chinese}
                </p>
                <p className="text-base text-muted-foreground" data-testid={`text-example-english-${index}`}>
                  {example.english}
                </p>
              </div>
            ))}
          </div>
          {character.examples.length > 3 && !showAllExamples && (
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
      </div>
    </div>
  );
}
