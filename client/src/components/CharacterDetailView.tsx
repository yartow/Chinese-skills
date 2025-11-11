import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ScriptToggle from "./ScriptToggle";
import StrokeOrder from "./StrokeOrder";

interface ExampleSentence {
  chinese: string;
  english: string;
}

interface CharacterDetailViewProps {
  character: {
    simplified: string;
    traditional: string;
    pinyin: string;
    radical: string;
    radicalPinyin: string;
    definition: string[];
    examples: ExampleSentence[];
  };
  onBack: () => void;
  isTraditional: boolean;
  onToggleScript: (isTraditional: boolean) => void;
}

export default function CharacterDetailView({
  character,
  onBack,
  isTraditional,
  onToggleScript,
}: CharacterDetailViewProps) {
  const [showAllExamples, setShowAllExamples] = useState(false);
  const displayChar = isTraditional ? character.traditional : character.simplified;
  const displayedExamples = showAllExamples ? character.examples : character.examples.slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={onBack}
            className="gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <ScriptToggle isTraditional={isTraditional} onToggle={onToggleScript} />
        </div>

        <div className="text-center">
          <div className="text-[12rem] font-chinese leading-none" data-testid="text-character-large">
            {displayChar}
          </div>
        </div>

        <Card className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Pinyin</h3>
            <p className="text-3xl font-semibold" data-testid="text-pinyin">{character.pinyin}</p>
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
