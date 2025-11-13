import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CharacterCard from "@/components/CharacterCard";
import ProgressFilter from "@/components/ProgressFilter";
import { ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserSettings, ChineseCharacter, CharacterProgress } from "@shared/schema";

export default function StandardMode() {
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(0);
  const [filterReading, setFilterReading] = useState(false);
  const [filterWriting, setFilterWriting] = useState(false);
  const [filterRadical, setFilterRadical] = useState(false);
  const [selectedHskLevels, setSelectedHskLevels] = useState<number[]>([]);

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  const pageSize = settings?.standardModePageSize ?? 20;
  const isTraditional = settings?.preferTraditional ?? false;

  // Fetch a larger batch to account for filtering
  // We'll fetch 3x the page size to increase likelihood of having enough characters after filtering
  const fetchSize = Math.min(pageSize * 3, 3000 - currentPage * pageSize);
  const startIndex = currentPage * pageSize;

  const { data: characters = [], isLoading: charactersLoading } = useQuery<ChineseCharacter[]>({
    queryKey: ["/api/characters/range", startIndex, fetchSize],
    enabled: fetchSize > 0,
  });

  const { data: progressList = [], isLoading: progressLoading } = useQuery<CharacterProgress[]>({
    queryKey: ["/api/progress/range", startIndex, fetchSize],
    enabled: fetchSize > 0,
  });

  const updateProgressMutation = useMutation({
    mutationFn: (progressData: { characterIndex: number; reading: boolean; writing: boolean; radical: boolean }) =>
      apiRequest("POST", "/api/progress", progressData),
    onMutate: async (newProgress) => {
      await queryClient.cancelQueries({ queryKey: ["/api/progress/range", startIndex, fetchSize] });
      const previousProgress = queryClient.getQueryData(["/api/progress/range", startIndex, fetchSize]);

      queryClient.setQueryData(["/api/progress/range", startIndex, fetchSize], (old: CharacterProgress[] = []) => {
        const existing = old.find(p => p.characterIndex === newProgress.characterIndex);
        if (existing) {
          return old.map(p => p.characterIndex === newProgress.characterIndex ? { ...p, ...newProgress } : p);
        }
        return [...old, { characterIndex: newProgress.characterIndex, ...newProgress }];
      });

      return { previousProgress };
    },
    onError: (err, newProgress, context) => {
      queryClient.setQueryData(["/api/progress/range", startIndex, fetchSize], context?.previousProgress);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/range", startIndex, fetchSize] });
    },
  });

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

  const handleToggleHskLevel = (level: number) => {
    setSelectedHskLevels((prev) =>
      prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level]
    );
  };

  // Apply filters and take exactly pageSize characters
  const filteredCharacters = useMemo(() => {
    let filtered = characters;

    // Apply HSK level filter
    if (selectedHskLevels.length > 0) {
      filtered = filtered.filter(char => selectedHskLevels.includes(char.hskLevel));
    }

    // Apply progress filters (show only unmastered)
    if (filterReading || filterWriting || filterRadical) {
      filtered = filtered.filter(char => {
        const progress = progressList.find(p => p.characterIndex === char.index);
        const reading = progress?.reading ?? false;
        const writing = progress?.writing ?? false;
        const radical = progress?.radical ?? false;

        return (
          (!filterReading || !reading) &&
          (!filterWriting || !writing) &&
          (!filterRadical || !radical)
        );
      });
    }

    return filtered.slice(0, pageSize);
  }, [characters, progressList, selectedHskLevels, filterReading, filterWriting, filterRadical, pageSize]);

  const hasNext = startIndex + pageSize < 3000;
  const hasPrevious = currentPage > 0;

  if (charactersLoading || progressLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">Standard Mode</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            Page {currentPage + 1} · Characters {startIndex + 1}-{startIndex + pageSize}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Showing {filteredCharacters.length} of {pageSize} characters
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={!hasPrevious}
                  data-testid="button-previous-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={!hasNext}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCharacters.map((char) => {
                const progress = progressList.find(p => p.characterIndex === char.index);
                return (
                  <CharacterCard
                    key={char.index}
                    character={char}
                    isTraditional={isTraditional}
                    progress={{
                      reading: progress?.reading ?? false,
                      writing: progress?.writing ?? false,
                      radical: progress?.radical ?? false,
                    }}
                    onToggleReading={() => handleToggleStar(char.index, "reading")}
                    onToggleWriting={() => handleToggleStar(char.index, "writing")}
                    onToggleRadical={() => handleToggleStar(char.index, "radical")}
                    onClick={() => setLocation(`/character/${char.index}`)}
                  />
                );
              })}
            </div>

            {filteredCharacters.length === 0 && (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">
                  No characters match your current filters. Try adjusting your filter settings.
                </p>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              <h2 className="text-lg font-semibold mb-4">Filters</h2>
              <ProgressFilter
                filterReading={filterReading}
                filterWriting={filterWriting}
                filterRadical={filterRadical}
                onToggleReading={() => setFilterReading(!filterReading)}
                onToggleWriting={() => setFilterWriting(!filterWriting)}
                onToggleRadical={() => setFilterRadical(!filterRadical)}
                selectedHskLevels={selectedHskLevels}
                onToggleHskLevel={handleToggleHskLevel}
              />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
