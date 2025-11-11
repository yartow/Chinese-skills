import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import CharacterCard from "@/components/CharacterCard";
import ScriptToggle from "@/components/ScriptToggle";
import SettingsPanel from "@/components/SettingsPanel";
import { Settings, LogOut } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserSettings, ChineseCharacter, CharacterProgress } from "@shared/schema";

export default function Home() {
  const [, setLocation] = useLocation();
  const [showSettings, setShowSettings] = useState(false);

  // Fetch user settings
  const { data: settings, isLoading: settingsLoading } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  const isTraditional = settings?.preferTraditional ?? false;
  const currentLevel = settings?.currentLevel ?? 0;
  const dailyCharCount = settings?.dailyCharCount ?? 5;

  // Fetch characters for current level
  const { data: characters = [], isLoading: charactersLoading } = useQuery<ChineseCharacter[]>({
    queryKey: ["/api/characters/range", currentLevel, 5],
    enabled: !settingsLoading,
  });

  // Fetch progress for current characters
  const { data: progressList = [] } = useQuery<CharacterProgress[]>({
    queryKey: ["/api/progress/range", currentLevel, 5],
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

  // Update character progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: (progressData: { characterIndex: number; reading: boolean; writing: boolean; radical: boolean }) =>
      apiRequest("POST", "/api/progress", progressData),
    onSuccess: () => {
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

  if (settingsLoading || charactersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const progressPercentage = (currentLevel / 2500) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold font-chinese">汉字学习</h1>
            <div className="text-sm text-muted-foreground">
              Level {currentLevel} / 2500
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
            You've learned {currentLevel} out of 2500 characters
          </p>
        </Card>

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
          <h2 className="text-xl font-semibold mb-4">
            Current Characters (Index {currentLevel} - {currentLevel + 4})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {characters.map((char) => {
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
      </main>
    </div>
  );
}
