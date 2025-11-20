import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Check, X, ArrowLeft, SkipForward } from "lucide-react";
import ScriptToggle from "@/components/ScriptToggle";
import type { UserSettings, ChineseCharacter, CharacterProgress } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

type TestType = "pronunciation" | "writing" | "radical";

interface TestModeProps {
  onStartTest: (testType: TestType, startIndex: number) => void;
}

interface TestResult {
  characterIndex: number;
  isCorrect: boolean;
}

export default function TestMode({ onStartTest }: TestModeProps) {
  const [testType, setTestType] = useState<TestType>("pronunciation");
  const [startIndex, setStartIndex] = useState(0);
  const [onlyUnmastered, setOnlyUnmastered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showResult, setShowResult] = useState<"correct" | "incorrect" | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [testCharacters, setTestCharacters] = useState<ChineseCharacter[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: Partial<UserSettings>) => 
      apiRequest("PATCH", "/api/settings", newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  const isTraditional = settings?.preferTraditional ?? false;
  
  const handleToggleScript = () => {
    updateSettingsMutation.mutate({
      preferTraditional: !isTraditional,
    });
  };

  // Focus input when component mounts or after result is shown
  useEffect(() => {
    if (isActive && !showResult && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive, showResult, currentQuestionIndex]);

  const handleStart = async () => {
    // Fetch all characters from startIndex to end (3000) in batches
    const totalCount = 3000 - startIndex;
    const allCharacters: ChineseCharacter[] = [];
    
    try {
      // Fetch in batches of 300
      for (let offset = 0; offset < totalCount; offset += 300) {
        const batchSize = Math.min(300, totalCount - offset);
        const charactersResponse = await fetch(`/api/characters/range/${startIndex + offset}/${batchSize}`);
        const batch: ChineseCharacter[] = await charactersResponse.json();
        allCharacters.push(...batch);
      }
      
      let filteredCharacters = allCharacters;
      
      // If onlyUnmastered is checked, filter by progress
      if (onlyUnmastered) {
        // Fetch progress in batches of 300
        const allProgress: CharacterProgress[] = [];
        for (let i = 0; i < allCharacters.length; i += 300) {
          const batch = allCharacters.slice(i, i + 300);
          const indices = batch.map(c => c.index).join(',');
          const progressResponse = await fetch(`/api/progress/batch?indices=${indices}`);
          const progressData: CharacterProgress[] = await progressResponse.json();
          allProgress.push(...progressData);
        }
        
        // Create a map for quick lookup
        const progressMap = new Map(allProgress.map(p => [p.characterIndex, p]));
        
        // Filter based on test type
        filteredCharacters = allCharacters.filter(char => {
          const progress = progressMap.get(char.index);
          if (!progress) return true; // Include if no progress (unmastered)
          
          if (testType === "pronunciation") return !progress.reading;
          if (testType === "writing") return !progress.writing;
          if (testType === "radical") return !progress.radical;
          return true;
        });
      }
      
      // Check if we have any characters to test
      if (filteredCharacters.length === 0) {
        alert("No characters to test! All characters in this range are already mastered.");
        return;
      }
      
      setTestCharacters(filteredCharacters);
      setIsActive(true);
      setCurrentQuestionIndex(0);
      setShowResult(null);
      setAnswer("");
      setTestResults([]);
      setShowSummary(false);
      onStartTest(testType, startIndex);
    } catch (error) {
      console.error("Error starting test:", error);
      alert("Failed to start test. Please try again.");
    }
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
    if (!answer.trim() || showResult !== null || testCharacters.length === 0) return;
    
    const current = testCharacters[currentQuestionIndex];
    let isCorrect = false;

    if (testType === "pronunciation") {
      isCorrect = normalizePinyin(answer) === normalizePinyin(current.pinyin);
    } else if (testType === "writing") {
      const correctAnswer = isTraditional 
        ? (current.traditionalVariants && current.traditionalVariants.length > 0 ? current.traditionalVariants[0] : current.traditional)
        : current.simplified;
      isCorrect = answer.trim() === correctAnswer;
    } else if (testType === "radical") {
      isCorrect = normalizePinyin(answer) === normalizePinyin(current.radicalPinyin || current.radical);
    }

    setShowResult(isCorrect ? "correct" : "incorrect");
    setTestResults([...testResults, { characterIndex: current.index, isCorrect }]);

    // For radical test with incorrect answer, don't auto-advance
    if (testType === "radical" && !isCorrect) {
      // Stay on this question, user must click Next or End Test
      return;
    }

    // Auto-advance after 1.5 seconds for correct answers or non-radical tests
    setTimeout(() => {
      handleNext();
    }, 1500);
  };

  const handleNext = () => {
    // Check if we've reached the end
    if (currentQuestionIndex >= testCharacters.length - 1) {
      setShowSummary(true);
      return;
    }
    
    setCurrentQuestionIndex(currentQuestionIndex + 1);
    setAnswer("");
    setShowResult(null);
  };

  const handleSkip = () => {
    handleNext();
  };

  const handleBackToSetup = () => {
    if (isActive || showSummary) {
      // If test is active or showing summary, reset to setup screen
      setIsActive(false);
      setCurrentQuestionIndex(0);
      setAnswer("");
      setShowResult(null);
      setTestResults([]);
      setShowSummary(false);
      setTestCharacters([]);
    } else {
      // If on setup screen, use browser's back button
      window.history.back();
    }
  };
  
  const handleEndTest = () => {
    setShowSummary(true);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && answer.trim() && showResult === null) {
      handleSubmit();
    }
  };

  if (!isActive) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Test Mode</h2>
          <ScriptToggle isTraditional={isTraditional} onToggle={handleToggleScript} />
        </div>

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
            <Label htmlFor="start-index">Starting Index (0-2999)</Label>
            <Input
              id="start-index"
              type="number"
              min="0"
              max="2999"
              value={startIndex}
              onChange={(e) => setStartIndex(Math.max(0, Math.min(2999, parseInt(e.target.value) || 0)))}
              data-testid="input-start-index"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="only-unmastered" 
              checked={onlyUnmastered}
              onCheckedChange={(checked) => setOnlyUnmastered(checked as boolean)}
              data-testid="checkbox-only-unmastered"
            />
            <Label htmlFor="only-unmastered" className="font-normal cursor-pointer">
              Test only characters that are not mastered
            </Label>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBackToSetup} className="flex-1" data-testid="button-back-to-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleStart} className="flex-1" data-testid="button-start-test">
              Start Test
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  
  // Show summary screen
  if (showSummary) {
    const correctCount = testResults.filter(r => r.isCorrect).length;
    const totalCount = testResults.length;
    const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h2 className="text-2xl font-semibold">Test Results</h2>
        
        <Card className="p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="text-6xl font-bold text-primary">{percentage}%</div>
            <div className="text-xl text-muted-foreground">
              {correctCount} out of {totalCount} correct
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-semibold">{totalCount}</div>
              <div className="text-sm text-muted-foreground">Tested</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-green-600 dark:text-green-400">{correctCount}</div>
              <div className="text-sm text-muted-foreground">Correct</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-red-600 dark:text-red-400">{totalCount - correctCount}</div>
              <div className="text-sm text-muted-foreground">Incorrect</div>
            </div>
          </div>
          
          <Button onClick={handleBackToSetup} className="w-full" data-testid="button-back-to-setup">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Card>
      </div>
    );
  }

  if (testCharacters.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Loading test...</p>
        </Card>
      </div>
    );
  }

  const current = testCharacters[currentQuestionIndex];

  const displayCharacter = testType === "writing" 
    ? current.pinyin 
    : (isTraditional 
        ? (current.traditionalVariants && current.traditionalVariants.length > 0 ? current.traditionalVariants[0] : current.traditional)
        : current.simplified);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {testType === "pronunciation" ? "Pronunciation Test" : testType === "writing" ? "Writing Test" : "Radical Test"}
        </h2>
        <div className="flex items-center gap-4">
          <ScriptToggle isTraditional={isTraditional} onToggle={handleToggleScript} />
          <div className="text-sm text-muted-foreground" data-testid="text-question-number">
            Index {current.index} • HSK {current.hskLevel}
          </div>
        </div>
      </div>

      <Card className="p-12 space-y-8">
        <div className="text-center">
          <div className="text-9xl font-chinese" data-testid="text-test-character">
            {displayCharacter}
          </div>
        </div>

        <div className="space-y-4">
          <Label htmlFor="answer">
            Your Answer
          </Label>
          <Input
            ref={inputRef}
            id="answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              testType === "pronunciation"
                ? "Enter pinyin (e.g., xue2 or xué)..."
                : testType === "writing"
                ? "Enter character..."
                : "Enter radical pinyin (e.g., zi3 or zǐ)..."
            }
            disabled={showResult !== null && testType !== "radical"}
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
            <div className={`space-y-2 ${showResult === "correct" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              <div className="flex items-center gap-2 text-sm">
                {showResult === "correct" ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Correct!</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    <span>Incorrect</span>
                  </>
                )}
              </div>
              {showResult === "incorrect" && (
                <div className="p-4 rounded-md bg-muted">
                  <div className="text-sm font-medium text-foreground mb-2">Correct answer:</div>
                  {testType === "pronunciation" ? (
                    <div className="text-lg text-foreground">{current.pinyin}</div>
                  ) : testType === "writing" ? (
                    <div className="text-4xl font-chinese text-foreground">
                      {isTraditional 
                        ? (current.traditionalVariants && current.traditionalVariants.length > 0 ? current.traditionalVariants[0] : current.traditional)
                        : current.simplified}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-4xl font-chinese text-foreground">{current.radical}</div>
                      <div className="text-lg text-foreground">{current.radicalPinyin || current.radical}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {testType === "radical" && showResult === "incorrect" ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleNext}
                  className="flex-1"
                  data-testid="button-next"
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  onClick={handleEndTest}
                  className="flex-1"
                  data-testid="button-end-test-incorrect"
                >
                  End Test
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  disabled={showResult !== null}
                  className="flex-1"
                  data-testid="button-skip"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  Skip
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!answer || showResult !== null}
                  className="flex-1"
                  data-testid="button-submit-answer"
                >
                  Submit Answer
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {!(testType === "radical" && showResult === "incorrect") && (
        <Button
          variant="outline"
          onClick={handleEndTest}
          className="w-full"
          data-testid="button-end-test"
        >
          End Test
        </Button>
      )}
    </div>
  );
}
