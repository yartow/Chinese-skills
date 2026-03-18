import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import CharacterCard from "@/components/CharacterCard";
import ScriptToggle from "@/components/ScriptToggle";
import SettingsPanel from "@/components/SettingsPanel";
import ProgressFilter from "@/components/ProgressFilter";
import { Settings, LogOut, Filter, ChevronDown, ChevronUp, BookOpen, PenTool, Grid3x3, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserSettings, ChineseCharacter, CharacterProgress } from "@shared/schema";

interface MasteryStats {
  readingMastered: number;
  writingMastered: number;
  radicalMastered: number;
  characterMastered: number;
  total: number;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterReading, setFilterReading] = useState(false);
  const [filterWriting, setFilterWriting] = useState(false);
  const [filterRadical, setFilterRadical] = useState(false);
  const [selectedHskLevels, setSelectedHskLevels] = useState<number[]>([]);

  // Fetch user settings
  const { data: settings, isLoading: settingsLoading } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  const isTraditional = settings?.preferTraditional ?? false;
  const currentLevel = settings?.currentLevel ?? 0;
  const dailyCharCount = settings?.dailyCharCount ?? 5;

  // Fetch characters for current level
  const { data: characters = [], isLoading: charactersLoading } = useQuery<ChineseCharacter[]>({
    queryKey: ["/api/characters/range", currentLevel, dailyCharCount],
    enabled: !settingsLoading,
  });

  // Fetch progress for current characters
  const { data: progressList = [] } = useQuery<CharacterProgress[]>({
    queryKey: ["/api/progress/range", currentLevel, dailyCharCount],
    enabled: !settingsLoading,
  });

  // Fetch mastery statistics for progress overview
  const { data: masteryStats } = useQuery<MasteryStats>({
    queryKey: ["/api/progress/stats"],
    enabled: !settingsLoading,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: Partial<UserSettings>) =>
      apiRequest("PATCH", "/api/settings", newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/characters/range"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress/range"] });
    },
  });

  // Update character progress mutation with optimistic updates
  const updateProgressMutation = useMutation({
    mutationFn: (progressData: { characterIndex: number; reading: boolean; writing: boolean; radical: boolean }) =>
      apiRequest("POST", "/api/progress", progressData),
    onMutate: async (newProgress) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/progress/range", currentLevel, dailyCharCount] });
      
      // Snapshot the previous value
      const previousProgress = queryClient.getQueryData<CharacterProgress[]>(["/api/progress/range", currentLevel, dailyCharCount]);
      
      // Optimistically update to the new value
      queryClient.setQueryData<CharacterProgress[]>(
        ["/api/progress/range", currentLevel, dailyCharCount],
        (old = []) => {
          const existingIndex = old.findIndex(p => p.characterIndex === newProgress.characterIndex);
          if (existingIndex >= 0) {
            // Update existing progress
            const updated = [...old];
            updated[existingIndex] = { ...updated[existingIndex], ...newProgress };
            return updated;
          } else {
            // Add new progress entry
            return [...old, newProgress as CharacterProgress];
          }
        }
      );
      
      // Return context with snapshot for rollback
      return { previousProgress };
    },
    onError: (err, newProgress, context) => {
      // Rollback on error
      if (context?.previousProgress) {
        queryClient.setQueryData(["/api/progress/range", currentLevel, dailyCharCount], context.previousProgress);
      }
    },
    onSettled: () => {
      // Always refetch after success or error
      queryClient.invalidateQueries({ queryKey: ["/api/progress/range"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress/stats"] });
    },
  });

  // Auto-progress to first non-mastered character on initial load
  const hasAutoProgressed = useRef(false);
  
  useEffect(() => {
    if (settingsLoading || hasAutoProgressed.current) return;
    
    const autoProgressLevel = async () => {
      try {
        const response = await fetch(`/api/progress/first-non-mastered/${currentLevel}`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          if (data.index > currentLevel && data.index < 3000) {
            updateSettingsMutation.mutate({ currentLevel: data.index });
          }
        }
      } catch (error) {
        console.error("Error auto-progressing level:", error);
      }
      hasAutoProgressed.current = true;
    };
    
    autoProgressLevel();
  }, [settingsLoading, currentLevel]);

  const handleLevelChange = (newLevel: number) => {
    updateSettingsMutation.mutate({ currentLevel: newLevel });
  };

  const handleDailyCharCountChange = (newCount: number) => {
    updateSettingsMutation.mutate({ dailyCharCount: newCount });
  };

  const handleScriptToggle = (traditional: boolean) => {
    updateSettingsMutation.mutate({ preferTraditional: traditional });
  };

  const handleToggleStar = (characterIndex: number, type: "reading" | "writing" | "radical") => {
    const progress = progressList.find(p => p.characterIndex === characterIndex) || {
      reading: false,
      writing: false,
      radical: false,
    };

    updateProgressMutation.mutate({
      characterIndex,
      reading: type === "reading" ? !progress.reading : progress.reading,
      writing: type === "writing" ? !progress.writing : progress.writing,
      radical: type === "radical" ? !progress.radical : progress.radical,
    });
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleToggleHskLevel = (level: number) => {
    setSelectedHskLevels((prev) =>
      prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level]
    );
  };

  if (settingsLoading || charactersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const progressPercentage = (currentLevel / 3000) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold font-chinese shrink-0">汉字学习</h1>
            <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              Lv {currentLevel} / 3000
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ScriptToggle isTraditional={isTraditional} onToggle={handleScriptToggle} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              data-testid="button-settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Progress Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Reading Mastered</span>
                </div>
                <span className="text-sm text-muted-foreground" data-testid="text-reading-mastered">
                  {masteryStats?.readingMastered ?? 0} / {masteryStats?.total ?? 3000}
                </span>
              </div>
              <Progress 
                value={((masteryStats?.readingMastered ?? 0) / (masteryStats?.total ?? 3000)) * 100} 
                className="h-2"
                data-testid="progress-reading" 
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Writing Mastered</span>
                </div>
                <span className="text-sm text-muted-foreground" data-testid="text-writing-mastered">
                  {masteryStats?.writingMastered ?? 0} / {masteryStats?.total ?? 3000}
                </span>
              </div>
              <Progress 
                value={((masteryStats?.writingMastered ?? 0) / (masteryStats?.total ?? 3000)) * 100} 
                className="h-2"
                data-testid="progress-writing" 
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Grid3x3 className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Radical Mastered</span>
                </div>
                <span className="text-sm text-muted-foreground" data-testid="text-radical-mastered">
                  {masteryStats?.radicalMastered ?? 0} / {masteryStats?.total ?? 3000}
                </span>
              </div>
              <Progress 
                value={((masteryStats?.radicalMastered ?? 0) / (masteryStats?.total ?? 3000)) * 100} 
                className="h-2"
                data-testid="progress-radical" 
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Character Mastered</span>
                </div>
                <span className="text-sm text-muted-foreground" data-testid="text-character-mastered">
                  {masteryStats?.characterMastered ?? 0} / {masteryStats?.total ?? 3000}
                </span>
              </div>
              <Progress 
                value={((masteryStats?.characterMastered ?? 0) / (masteryStats?.total ?? 3000)) * 100} 
                className="h-2"
                data-testid="progress-character" 
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground pt-2">
            A character is fully mastered when reading, writing, and radical are all mastered.
          </p>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            {showSettings && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Settings</h2>
                <SettingsPanel
                  currentLevel={currentLevel}
                  dailyCharCount={dailyCharCount}
                  standardModePageSize={settings?.standardModePageSize}
                  onLevelChange={handleLevelChange}
                  onDailyCharCountChange={handleDailyCharCountChange}
                  onStandardModePageSizeChange={(size) => updateSettingsMutation.mutate({ standardModePageSize: size })}
                />
              </Card>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <h2 className="text-base sm:text-xl font-semibold">
                  <span className="hidden sm:inline">Characters </span>
                  ({currentLevel}–{currentLevel + dailyCharCount - 1})
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLevelChange(Math.max(0, currentLevel - dailyCharCount))}
                    disabled={currentLevel === 0}
                    data-testid="button-previous"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLevelChange(Math.min(3000 - dailyCharCount, currentLevel + dailyCharCount))}
                    disabled={currentLevel >= 3000 - dailyCharCount}
                    data-testid="button-next"
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    data-testid="button-toggle-filters"
                    className="lg:hidden"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {characters
                  .filter((char) => {
                    // Filter by HSK level first (if any levels are selected)
                    if (selectedHskLevels.length > 0 && !selectedHskLevels.includes(char.hskLevel)) {
                      return false;
                    }
                    
                    // If no progress filters are active, show the character
                    if (!filterReading && !filterWriting && !filterRadical) return true;
                    
                    const progress = progressList.find(p => p.characterIndex === char.index);
                    
                    // Show only characters that are NOT mastered in ALL selected filter areas
                    // If a filter is on and character IS mastered in that area, exclude it
                    if (filterReading && (progress?.reading ?? false)) return false;
                    if (filterWriting && (progress?.writing ?? false)) return false;
                    if (filterRadical && (progress?.radical ?? false)) return false;
                    
                    // Character is not mastered in at least one selected area, include it
                    return true;
                  })
                  .map((char) => {
                    const progress = progressList.find(p => p.characterIndex === char.index);
                    return (
                      <CharacterCard
                        key={char.index}
                        character={isTraditional ? char.traditional : char.simplified}
                        reading={progress?.reading ?? false}
                        writing={progress?.writing ?? false}
                        radical={progress?.radical ?? false}
                        onToggleReading={() => handleToggleStar(char.index, "reading")}
                        onToggleWriting={() => handleToggleStar(char.index, "writing")}
                        onToggleRadical={() => handleToggleStar(char.index, "radical")}
                        onClick={() => setLocation(`/character/${char.index}`)}
                      />
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className={showFilters ? undefined : "hidden lg:block"}>
              <Card className="p-6 sticky top-6">
                <h2 className="text-lg font-semibold mb-4">Filters</h2>
                <ProgressFilter
                  filterReading={filterReading}
                  filterWriting={filterWriting}
                  filterRadical={filterRadical}
                  onToggleFilterReading={() => setFilterReading(!filterReading)}
                  onToggleFilterWriting={() => setFilterWriting(!filterWriting)}
                  onToggleFilterRadical={() => setFilterRadical(!filterRadical)}
                  selectedHskLevels={selectedHskLevels}
                  onToggleHskLevel={handleToggleHskLevel}
                />
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
