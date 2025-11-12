import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowRight, Check, X } from "lucide-react";

type TestType = "pronunciation" | "writing" | "radical";

interface TestModeProps {
  onStartTest: (testType: TestType, startIndex: number) => void;
}

export default function TestMode({ onStartTest }: TestModeProps) {
  const [testType, setTestType] = useState<TestType>("pronunciation");
  const [startIndex, setStartIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showResult, setShowResult] = useState<"correct" | "incorrect" | null>(null);

  const mockQuestions = [
    { character: "学", pinyin: "xué", radical: "子" },
    { character: "生", pinyin: "shēng", radical: "生" },
    { character: "中", pinyin: "zhōng", radical: "丨" },
  ];

  const handleStart = () => {
    setIsActive(true);
    setCurrentIndex(0);
    setShowResult(null);
    setAnswer("");
    onStartTest(testType, startIndex);
  };

  // Helper function to normalize pinyin for comparison
  // Accepts both tone marks (xué) and numbered tones (xue2)
  const normalizePinyin = (pinyin: string): string => {
    // Convert to lowercase
    let normalized = pinyin.toLowerCase().trim();
    
    // Remove tone numbers (1-5)
    normalized = normalized.replace(/[1-5]/g, "");
    
    // Remove tone marks by converting to base letters
    const toneMap: Record<string, string> = {
      'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a', 'a': 'a',
      'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e', 'e': 'e',
      'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i', 'i': 'i',
      'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o', 'o': 'o',
      'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u', 'u': 'u',
      'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü', 'ü': 'ü',
    };
    
    for (const [toned, base] of Object.entries(toneMap)) {
      normalized = normalized.replace(new RegExp(toned, 'g'), base);
    }
    
    // Remove spaces for flexible matching
    normalized = normalized.replace(/\s+/g, "");
    
    return normalized;
  };

  const handleSubmit = () => {
    const current = mockQuestions[currentIndex % mockQuestions.length];
    let isCorrect = false;

    if (testType === "pronunciation") {
      // Accept both regular pinyin (xué) and numbered pinyin (xue2)
      isCorrect = normalizePinyin(answer) === normalizePinyin(current.pinyin);
    } else if (testType === "writing") {
      isCorrect = answer === current.character;
    } else if (testType === "radical") {
      isCorrect = answer === current.radical;
    }

    setShowResult(isCorrect ? "correct" : "incorrect");

    setTimeout(() => {
      setCurrentIndex(currentIndex + 1);
      setAnswer("");
      setShowResult(null);
    }, 1500);
  };

  if (!isActive) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h2 className="text-2xl font-semibold">Test Mode</h2>

        <Card className="p-6 space-y-6">
          <div className="space-y-3">
            <Label>Test Type</Label>
            <RadioGroup value={testType} onValueChange={(v) => setTestType(v as TestType)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pronunciation" id="pronunciation" data-testid="radio-pronunciation" />
                <Label htmlFor="pronunciation" className="font-normal cursor-pointer">
                  Pronunciation (Show character, test pinyin)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="writing" id="writing" data-testid="radio-writing" />
                <Label htmlFor="writing" className="font-normal cursor-pointer">
                  Writing (Show pinyin, test character)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="radical" id="radical" data-testid="radio-radical" />
                <Label htmlFor="radical" className="font-normal cursor-pointer">
                  Radical (Show character, test radical)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-index">Starting Index (0-2500)</Label>
            <Input
              id="start-index"
              type="number"
              min="0"
              max="2500"
              value={startIndex}
              onChange={(e) => setStartIndex(Math.max(0, Math.min(2500, parseInt(e.target.value) || 0)))}
              data-testid="input-start-index"
            />
          </div>

          <Button onClick={handleStart} className="w-full" data-testid="button-start-test">
            Start Test
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Card>
      </div>
    );
  }

  const current = mockQuestions[currentIndex % mockQuestions.length];

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {testType === "pronunciation" ? "Pronunciation Test" : testType === "writing" ? "Writing Test" : "Radical Test"}
        </h2>
        <div className="text-sm text-muted-foreground" data-testid="text-question-number">
          Question {currentIndex + 1}
        </div>
      </div>

      <Card className="p-12 space-y-8">
        <div className="text-center">
          <div className="text-9xl font-chinese" data-testid="text-test-character">
            {testType === "writing" ? current.pinyin : current.character}
          </div>
        </div>

        <div className="space-y-4">
          <Label htmlFor="answer">
            Your Answer
          </Label>
          <Input
            id="answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={
              testType === "pronunciation"
                ? "Enter pinyin (e.g., xue2 or xué)..."
                : testType === "writing"
                ? "Enter character..."
                : "Enter radical..."
            }
            disabled={showResult !== null}
            data-testid="input-test-answer"
            className={
              showResult === "correct"
                ? "border-green-500 bg-green-50 dark:bg-green-950"
                : showResult === "incorrect"
                ? "border-red-500 bg-red-50 dark:bg-red-950"
                : ""
            }
          />

          {showResult && (
            <div className={`flex items-center gap-2 text-sm ${showResult === "correct" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {showResult === "correct" ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Correct!</span>
                </>
              ) : (
                <>
                  <X className="w-4 h-4" />
                  <span>Incorrect. The answer was: {testType === "pronunciation" ? current.pinyin : testType === "writing" ? current.character : current.radical}</span>
                </>
              )}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!answer || showResult !== null}
            className="w-full"
            data-testid="button-submit-answer"
          >
            Submit Answer
          </Button>
        </div>
      </Card>

      <Button
        variant="outline"
        onClick={() => setIsActive(false)}
        className="w-full"
        data-testid="button-end-test"
      >
        End Test
      </Button>
    </div>
  );
}
