import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CharacterCard from "@/components/CharacterCard";
import ProgressFilter from "@/components/ProgressFilter";
import { ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserSettings, ChineseCharacter, CharacterProgress } from "@shared/schema";

interface FilteredCharactersResponse {
  characters: ChineseCharacter[];
  total: number;
}

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

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [filterReading, filterWriting, filterRadical, selectedHskLevels]);

  const { data, isLoading } = useQuery<FilteredCharactersResponse>({
    queryKey: [
      "/api/characters/filtered",
      currentPage,
      pageSize,
      selectedHskLevels,
      filterReading,
      filterWriting,
      filterRadical
    ],
    queryFn: async ({ queryKey }) => {
      // Destructure fresh values from queryKey instead of closing over stale component state
      const [_, page, size, hskLevels, reading, writing, radical] = queryKey;

      const queryParams = new URLSearchParams({
        page: String(page),
        pageSize: String(size),
      });

      if (Array.isArray(hskLevels) && hskLevels.length > 0) {
        queryParams.set('hskLevels', hskLevels.join(','));
      }
      if (reading) {
        queryParams.set('filterReading', 'true');
      }
      if (writing) {
        queryParams.set('filterWriting', 'true');
      }
      if (radical) {
        queryParams.set('filterRadical', 'true');
      }

      const res = await fetch(`/api/characters/filtered?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
  });

  const characters = data?.characters ?? [];
  const totalCharacters = data?.total ?? 0;

  // Fetch progress in a single batch request to avoid sparse range issues and performance problems
  const characterIndices = characters.map(c => c.index);
  const { data: progressList = [] } = useQuery<CharacterProgress[]>({
    queryKey: ["/api/progress/batch", characterIndices.join(',')],
    queryFn: async ({ queryKey }) => {
      const [_, indicesString] = queryKey;
      if (!indicesString || indicesString === '') return [];
      
      const res = await fetch(`/api/progress/batch?indices=${indicesString}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
    enabled: characters.length > 0,
  });

  const updateProgressMutation = useMutation({
    mutationFn: (progressData: { characterIndex: number; reading: boolean; writing: boolean; radical: boolean }) =>
      apiRequest("POST", "/api/progress", progressData),
    onSuccess: () => {
      // Invalidate both the filtered characters and progress queries
      queryClient.invalidateQueries({ queryKey: ["/api/characters/filtered"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress/batch"] });
    },
  });

  const handleToggleStar = (characterIndex: number, type: "reading" | "writing" | "radical") => {
    const progress = progressList.find((p: CharacterProgress) => p.characterIndex === characterIndex) || {
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

  const totalPages = Math.ceil(totalCharacters / pageSize);
  const hasNext = currentPage < totalPages - 1;
  const hasPrevious = currentPage > 0;

  if (isLoading) {
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
            Page {currentPage + 1} of {totalPages} · {totalCharacters} total characters
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Showing {characters.length} characters
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
              {characters.map((char) => {
                const progress = progressList.find((p: CharacterProgress) => p.characterIndex === char.index);
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

            {characters.length === 0 && (
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
                onToggleFilterReading={() => setFilterReading(!filterReading)}
                onToggleFilterWriting={() => setFilterWriting(!filterWriting)}
                onToggleFilterRadical={() => setFilterRadical(!filterRadical)}
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
