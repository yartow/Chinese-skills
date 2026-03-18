import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowRight, Check, X, ArrowLeft, SkipForward, BookOpen } from "lucide-react";
import ScriptToggle from "@/components/ScriptToggle";
import CharacterBrowser from "@/components/CharacterBrowser";
import type { UserSettings, ChineseCharacter, CharacterProgress } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

type TestType = "pronunciation" | "writing" | "radical";
type FilterMode = "startIndex" | "lesson" | "lessonRange";

interface TestModeProps {
  onStartTest: (testType: TestType, startIndex: number) => void;
}

interface TestResult {
  characterIndex: number;
  isCorrect: boolean;
}

export default function TestMode({ onStartTest }: TestModeProps) {
  const [testType, setTestType] = useState<TestType>("pronunciation");
  const [filterMode, setFilterMode] = useState<FilterMode>("startIndex");
  const [startIndex, setStartIndex] = useState(0);
  const [lessonNumber, setLessonNumber] = useState(1);
  const [lessonRangeStart, setLessonRangeStart] = useState(1);
  const [lessonRangeEnd, setLessonRangeEnd] = useState(1);
  const [onlyUnmastered, setOnlyUnmastered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showResult, setShowResult] = useState<"correct" | "incorrect" | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [testCharacters, setTestCharacters] = useState<ChineseCharacter[]>([]);
  const [showBrowser, setShowBrowser] = useState(false);
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
    updateSettingsMutation.mutate({ preferTraditional: !isTraditional });
  };

  useEffect(() => {
    if (isActive && !showResult && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive, showResult, currentQuestionIndex]);

  const handleStart = async () => {
    let allCharacters: ChineseCharacter[] = [];

    try {
      if (filterMode === "startIndex") {
        const totalCount = 3000 - startIndex;
        for (let offset = 0; offset < totalCount; offset += 300) {
          const batchSize = Math.min(300, totalCount - offset);
          const resp = await fetch(`/api/characters/range/${startIndex + offset}/${batchSize}`);
          const batch: ChineseCharacter[] = await resp.json();
          allCharacters.push(...batch);
        }
      } else if (filterMode === "lesson") {
        const resp = await fetch(`/api/characters/by-lesson?lesson=${lessonNumber}`);
        if (!resp.ok) throw new Error("Failed to fetch lesson characters");
        allCharacters = await resp.json();
      } else if (filterMode === "lessonRange") {
        const resp = await fetch(`/api/characters/by-lesson?lessonStart=${lessonRangeStart}&lessonEnd=${lessonRangeEnd}`);
        if (!resp.ok) throw new Error("Failed to fetch lesson range characters");
        allCharacters = await resp.json();
      }

      let filteredCharacters = allCharacters;

      if (onlyUnmastered && allCharacters.length > 0) {
        const allProgress: CharacterProgress[] = [];
        for (let i = 0; i < allCharacters.length; i += 300) {
          const batch = allCharacters.slice(i, i + 300);
          const indices = batch.map((c) => c.index).join(",");
          const progressResp = await fetch(`/api/progress/batch?indices=${indices}`);
          const progressData: CharacterProgress[] = await progressResp.json();
          allProgress.push(...progressData);
        }

        const progressMap = new Map(allProgress.map((p) => [p.characterIndex, p]));

        filteredCharacters = allCharacters.filter((char) => {
          const progress = progressMap.get(char.index);
          if (!progress) return true;
          if (testType === "pronunciation") return !progress.reading;
          if (testType === "writing") return !progress.writing;
          if (testType === "radical") return !progress.radical;
          return true;
        });
      }

      if (filteredCharacters.length === 0) {
        alert(
          allCharacters.length === 0
            ? "No characters found for the selected filter. Make sure lesson numbers are assigned via the admin Excel import."
            : "No characters to test! All characters in this range are already mastered."
        );
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

  const normalizePinyin = (pinyin: string): string => {
    let normalized = pinyin.toLowerCase().trim();
    normalized = normalized.replace(/[1-5]/g, "");
    const toneMap: Record<string, string> = {
      ā: "a", á: "a", ǎ: "a", à: "a", a: "a",
      ē: "e", é: "e", ě: "e", è: "e", e: "e",
      ī: "i", í: "i", ǐ: "i", ì: "i", i: "i",
      ō: "o", ó: "o", ǒ: "o", ò: "o", o: "o",
      ū: "u", ú: "u", ǔ: "u", ù: "u", u: "u",
      ǖ: "ü", ǘ: "ü", ǚ: "ü", ǜ: "ü", ü: "ü",
    };
    for (const [toned, base] of Object.entries(toneMap)) {
      normalized = normalized.replace(new RegExp(toned, "g"), base);
    }
    normalized = normalized.replace(/\s+/g, "");
    return normalized;
  };

  const handleSubmit = () => {
    if (!answer.trim() || showResult !== null || testCharacters.length === 0) return;

    const current = testCharacters[currentQuestionIndex];
    let isCorrect = false;

    if (testType === "pronunciation") {
      if (!/\d/.test(answer)) {
        alert("Please use numbered pinyin (e.g., 'xue2' instead of 'xue')");
        return;
      }
      const normalizedAnswer = normalizePinyin(answer);
      const validPinyins: string[] = [current.pinyin];
      if (current.pinyin2) validPinyins.push(current.pinyin2);
      if (current.pinyin3) validPinyins.push(current.pinyin3);
      if (current.numberedPinyin) validPinyins.push(current.numberedPinyin);
      if (current.numberedPinyin2) validPinyins.push(current.numberedPinyin2);
      if (current.numberedPinyin3) validPinyins.push(current.numberedPinyin3);
      isCorrect = validPinyins.some((p) => normalizePinyin(p) === normalizedAnswer);
    } else if (testType === "writing") {
      const correctAnswer = isTraditional
        ? current.traditionalVariants && current.traditionalVariants.length > 0
          ? current.traditionalVariants[0]
          : current.traditional
        : current.simplified;
      isCorrect = answer.trim() === correctAnswer;
    } else if (testType === "radical") {
      if (!/\d/.test(answer)) {
        alert("Please use numbered pinyin (e.g., 'shu4' instead of 'shu')");
        return;
      }
      isCorrect = normalizePinyin(answer) === normalizePinyin(current.radicalPinyin || "");
    }

    setShowResult(isCorrect ? "correct" : "incorrect");
    setTestResults([...testResults, { characterIndex: current.index, isCorrect }]);

    if (testType === "radical" && !isCorrect) return;

    setTimeout(() => {
      handleNext();
    }, 1500);
  };

  const handleMastered = async () => {
    const current = testCharacters[currentQuestionIndex];
    setShowResult("correct");
    setTestResults([...testResults, { characterIndex: current.index, isCorrect: true }]);

    try {
      const progressType =
        testType === "pronunciation" ? "reading" : testType === "writing" ? "writing" : "radical";
      await apiRequest("POST", "/api/progress", {
        characterIndex: current.index,
        [progressType]: true,
        reading: testType === "pronunciation" ? true : undefined,
        writing: testType === "writing" ? true : undefined,
        radical: testType === "radical" ? true : undefined,
      });
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "/api/progress" || query.queryKey[0] === "/api/progress/batch",
      });
    } catch (error) {
      console.error("Error updating progress:", error);
    }

    setTimeout(() => {
      handleNext();
    }, 500);
  };

  const handleShowAnswer = () => {
    const current = testCharacters[currentQuestionIndex];
    if (testType === "pronunciation") {
      let ans = current.pinyin;
      if (current.pinyin2) ans += ` / ${current.pinyin2}`;
      if (current.pinyin3) ans += ` / ${current.pinyin3}`;
      alert(`Answer: ${ans}`);
    } else if (testType === "writing") {
      const ans = isTraditional
        ? current.traditionalVariants && current.traditionalVariants.length > 0
          ? current.traditionalVariants[0]
          : current.traditional
        : current.simplified;
      alert(`Answer: ${ans}`);
    } else if (testType === "radical") {
      alert(`Answer: ${current.radicalPinyin || current.radical}`);
    }
  };

  const handleNext = () => {
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
      setIsActive(false);
      setCurrentQuestionIndex(0);
      setAnswer("");
      setShowResult(null);
      setTestResults([]);
      setShowSummary(false);
      setTestCharacters([]);
    } else {
      window.history.back();
    }
  };

  const handleEndTest = () => {
    setShowSummary(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && answer.trim() && showResult === null) {
      handleSubmit();
    }
  };

  if (!isActive) {
    return (
      <>
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

            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label>Character Filter</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBrowser(true)}
                  data-testid="button-browse-for-index"
                >
                  <BookOpen className="w-3 h-3 mr-1" />
                  Browse Characters
                </Button>
              </div>
              <RadioGroup
                value={filterMode}
                onValueChange={(v) => setFilterMode(v as FilterMode)}
                className="space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="startIndex" id="filter-start-index" data-testid="radio-filter-start-index" />
                    <Label htmlFor="filter-start-index" className="font-normal cursor-pointer">
                      Starting from index
                    </Label>
                  </div>
                  {filterMode === "startIndex" && (
                    <div className="ml-6">
                      <Input
                        type="number"
                        min="0"
                        max="2999"
                        value={startIndex}
                        onChange={(e) =>
                          setStartIndex(Math.max(0, Math.min(2999, parseInt(e.target.value) || 0)))
                        }
                        data-testid="input-start-index"
                        className="w-32"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="lesson" id="filter-lesson" data-testid="radio-filter-lesson" />
                    <Label htmlFor="filter-lesson" className="font-normal cursor-pointer">
                      Specific lesson
                    </Label>
                  </div>
                  {filterMode === "lesson" && (
                    <div className="ml-6">
                      <Input
                        type="number"
                        min="1"
                        value={lessonNumber}
                        onChange={(e) => setLessonNumber(Math.max(1, parseInt(e.target.value) || 1))}
                        data-testid="input-lesson-number"
                        className="w-32"
                        placeholder="Lesson #"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="lessonRange" id="filter-lesson-range" data-testid="radio-filter-lesson-range" />
                    <Label htmlFor="filter-lesson-range" className="font-normal cursor-pointer">
                      Range of lessons
                    </Label>
                  </div>
                  {filterMode === "lessonRange" && (
                    <div className="ml-6 flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={lessonRangeStart}
                        onChange={(e) => {
                          const newStart = Math.max(1, parseInt(e.target.value) || 1);
                          setLessonRangeStart(newStart);
                          setLessonRangeEnd((prev) => Math.max(prev, newStart));
                        }}
                        data-testid="input-lesson-range-start"
                        className="w-24"
                        placeholder="From"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input
                        type="number"
                        min={lessonRangeStart}
                        value={lessonRangeEnd}
                        onChange={(e) =>
                          setLessonRangeEnd(
                            Math.max(lessonRangeStart, parseInt(e.target.value) || lessonRangeStart)
                          )
                        }
                        data-testid="input-lesson-range-end"
                        className="w-24"
                        placeholder="To"
                      />
                    </div>
                  )}
                </div>
              </RadioGroup>
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
              <Button
                variant="outline"
                onClick={handleBackToSetup}
                className="flex-1"
                data-testid="button-back-to-home"
              >
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

        <Sheet open={showBrowser} onOpenChange={setShowBrowser}>
          <SheetContent
            side="right"
            className="w-full sm:max-w-2xl flex flex-col p-6 gap-0"
          >
            <SheetHeader className="pb-4">
              <SheetTitle>Character Browser</SheetTitle>
              <SheetDescription>
                Click "Use" next to a character to use its index as your starting point.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0">
              <CharacterBrowser
                onSelectIndex={(idx) => {
                  setStartIndex(idx);
                  setFilterMode("startIndex");
                  setShowBrowser(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (showSummary) {
    const correctCount = testResults.filter((r) => r.isCorrect).length;
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
              <div className="text-2xl font-semibold text-green-600 dark:text-green-400">
                {correctCount}
              </div>
              <div className="text-sm text-muted-foreground">Correct</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-red-600 dark:text-red-400">
                {totalCount - correctCount}
              </div>
              <div className="text-sm text-muted-foreground">Incorrect</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleBackToSetup}
              className="flex-1"
              variant="outline"
              data-testid="button-back-to-setup"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={() => (window.location.href = "/test")}
              className="flex-1"
              data-testid="button-new-test"
            >
              New Test
            </Button>
          </div>
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

  const displayCharacter =
    testType === "writing"
      ? current.pinyin
      : isTraditional
      ? current.traditionalVariants && current.traditionalVariants.length > 0
        ? current.traditionalVariants[0]
        : current.traditional
      : current.simplified;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base sm:text-xl font-semibold shrink-0">
          {testType === "pronunciation"
            ? "Pronunciation Test"
            : testType === "writing"
            ? "Writing Test"
            : "Radical Test"}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          <ScriptToggle isTraditional={isTraditional} onToggle={handleToggleScript} />
          <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap" data-testid="text-question-number">
            #{current.index} HSK{current.hskLevel}
          </div>
        </div>
      </div>

      <Card className="p-6 sm:p-12 space-y-8">
        <div className="text-center">
          <div className="text-9xl font-chinese" data-testid="text-test-character">
            {displayCharacter}
          </div>
        </div>

        <div className="space-y-4">
          <Label htmlFor="answer">Your Answer</Label>
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
            <div
              className={`space-y-2 ${
                showResult === "correct"
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
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
                    <div className="text-lg text-foreground">
                      {current.pinyin}
                      {current.pinyin2 && (
                        <span className="text-muted-foreground ml-2">/ {current.pinyin2}</span>
                      )}
                      {current.pinyin3 && (
                        <span className="text-muted-foreground ml-2">/ {current.pinyin3}</span>
                      )}
                    </div>
                  ) : testType === "writing" ? (
                    <div className="text-4xl font-chinese text-foreground">
                      {isTraditional
                        ? current.traditionalVariants && current.traditionalVariants.length > 0
                          ? current.traditionalVariants[0]
                          : current.traditional
                        : current.simplified}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-lg text-foreground">
                        {current.radicalPinyin || "(No radical pinyin)"}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            {testType === "writing" && !showResult ? (
              <>
                <div className="flex gap-2 sm:contents">
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    className="flex-1"
                    data-testid="button-skip"
                  >
                    <SkipForward className="w-4 h-4 mr-2" />
                    Skip
                  </Button>
                  <Button onClick={handleMastered} className="flex-1" data-testid="button-mastered">
                    Mastered
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={handleShowAnswer}
                  className="w-full sm:flex-1"
                  data-testid="button-show-answer"
                >
                  Show Answer
                </Button>
              </>
            ) : testType === "radical" && showResult === "incorrect" ? (
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
