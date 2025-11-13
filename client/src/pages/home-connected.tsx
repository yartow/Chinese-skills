import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import CharacterCard from "@/components/CharacterCard";
import ScriptToggle from "@/components/ScriptToggle";
import SettingsPanel from "@/components/SettingsPanel";
import ProgressFilter from "@/components/ProgressFilter";
import { Settings, LogOut, Filter } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserSettings, ChineseCharacter, CharacterProgress } from "@shared/schema";

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
    },
  });

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
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold font-chinese">汉字学习</h1>
            <div className="text-sm text-muted-foreground">
              Level {currentLevel} / 3000
            </div>
          </div>
          <div className="flex items-center gap-4">
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Progress Overview</h2>
            <span className="text-sm text-muted-foreground" data-testid="text-progress-percentage">
              {progressPercentage.toFixed(1)}%
            </span>
          </div>
          <Progress value={progressPercentage} data-testid="progress-overall" />
          <p className="text-sm text-muted-foreground">
            You've learned {currentLevel} out of 3000 characters
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
                  onLevelChange={handleLevelChange}
                  onDailyCharCountChange={handleDailyCharCountChange}
                />
              </Card>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">
                    Current Characters (Index {currentLevel} - {currentLevel + dailyCharCount - 1})
                  </h2>
                </div>
                <div className="flex items-center gap-2">
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
            {(showFilters || window.innerWidth >= 1024) && (
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
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
