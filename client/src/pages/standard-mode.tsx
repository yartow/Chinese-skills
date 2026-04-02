import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CharacterCard from "@/components/CharacterCard";
import ProgressFilter from "@/components/ProgressFilter";
import { ArrowLeft, Filter, ArrowRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserSettings, ChineseCharacter, CharacterProgress } from "@shared/schema";

interface FilteredCharactersResponse {
  characters: ChineseCharacter[];
  total: number;
}

export default function StandardMode() {
  const [location, setLocation] = useLocation();

  // Initialize all filter state directly from the URL so that navigating back
  // from a character detail page restores exactly the same view.
  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    return parseInt(params.get('page') || '0');
  });
  const [filterReading, setFilterReading] = useState(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    return params.get('filterReading') === 'true';
  });
  const [filterWriting, setFilterWriting] = useState(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    return params.get('filterWriting') === 'true';
  });
  const [filterRadical, setFilterRadical] = useState(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    return params.get('filterRadical') === 'true';
  });
  const [selectedHskLevels, setSelectedHskLevels] = useState<number[]>(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const hskLevelsStr = params.get('hskLevels');
    return hskLevelsStr ? hskLevelsStr.split(',').map(Number) : [];
  });
  const [showFilters, setShowFilters] = useState(false);
  const [jumpInput, setJumpInput] = useState("");

  // Used to skip the page-reset on the very first render (filters haven't changed,
  // they were just restored from the URL above).
  const isFirstRender = useRef(true);

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  const pageSize = settings?.standardModePageSize ?? 20;
  const isTraditional = settings?.preferTraditional ?? false;

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (currentPage > 0) {
      params.set('page', String(currentPage));
    }
    if (filterReading) {
      params.set('filterReading', 'true');
    }
    if (filterWriting) {
      params.set('filterWriting', 'true');
    }
    if (filterRadical) {
      params.set('filterRadical', 'true');
    }
    if (selectedHskLevels.length > 0) {
      params.set('hskLevels', selectedHskLevels.join(','));
    }

    const queryString = params.toString();
    const newLocation = queryString ? `/standard?${queryString}` : '/standard';
    
    // Only update if location actually changed to avoid unnecessary updates
    if (location !== newLocation) {
      setLocation(newLocation);
    }
  }, [currentPage, filterReading, filterWriting, filterRadical, selectedHskLevels, location, setLocation]);

  // Reset to first page when filters change — but not on the initial render,
  // because the filters were already restored from the URL.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
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

  // Per-character debounce timers — rapid clicks accumulate into one API call
  const debounceMap = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const updateProgressMutation = useMutation({
    mutationFn: (progressData: { characterIndex: number; reading: boolean; writing: boolean; radical: boolean }) =>
      apiRequest("POST", "/api/progress", progressData),
    onSettled: () => {
      queryClient.invalidateQueries({ predicate: (query) =>
        query.queryKey[0] === "/api/progress/batch" ||
        query.queryKey[0] === "/api/progress/range" ||
        (query.queryKey[0] === "/api/progress" && typeof query.queryKey[1] === "number")
      });
    },
  });

  const handleToggleStar = (charIndex: number, type: "reading" | "writing" | "radical") => {
    // Read from the live cache (not the render closure) so rapid clicks stack correctly
    const cacheKey = ["/api/progress/batch", characterIndices.join(',')];
    const currentList = queryClient.getQueryData<CharacterProgress[]>(cacheKey) || [];
    const current = currentList.find((p: CharacterProgress) => p.characterIndex === charIndex) || {
      reading: false, writing: false, radical: false,
    };

    const next = {
      characterIndex: charIndex,
      reading: type === "reading" ? !current.reading : current.reading,
      writing: type === "writing" ? !current.writing : current.writing,
      radical: type === "radical" ? !current.radical : current.radical,
    };

    // Immediately update the cache so the UI responds without waiting for the server
    queryClient.setQueryData<CharacterProgress[]>(cacheKey, (old = []) => {
      const idx = old.findIndex((p: CharacterProgress) => p.characterIndex === charIndex);
      if (idx >= 0) {
        const updated = [...old];
        updated[idx] = { ...updated[idx], ...next };
        return updated;
      }
      return [...old, next as CharacterProgress];
    });

    // Debounce the API call per character — cancel previous timer and reschedule
    const existing = debounceMap.current.get(charIndex);
    if (existing) clearTimeout(existing);
    debounceMap.current.set(charIndex, setTimeout(() => {
      debounceMap.current.delete(charIndex);
      updateProgressMutation.mutate(next);
    }, 400));
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

  const handleJumpToIndex = () => {
    const targetIndex = parseInt(jumpInput, 10);
    if (isNaN(targetIndex) || targetIndex < 1) return;
    const targetPage = Math.floor((targetIndex - 1) / pageSize);
    const clampedPage = Math.min(Math.max(targetPage, 0), totalPages - 1);
    setCurrentPage(clampedPage);
    setJumpInput("");
  };

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
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg sm:text-2xl font-bold truncate">Standard Mode</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
              Page {currentPage + 1} of {totalPages} · {totalCharacters} chars
            </span>
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
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground shrink-0">Go to index:</span>
                <Input
                  type="number"
                  min={1}
                  max={3000}
                  placeholder="e.g. 500"
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJumpToIndex()}
                  className="w-28"
                  data-testid="input-jump-to-index"
                />
                <Button
                  variant="outline"
                  onClick={handleJumpToIndex}
                  disabled={jumpInput === ""}
                  data-testid="button-jump-to-index"
                  className="gap-1"
                >
                  Go
                  <ArrowRight className="w-4 h-4" />
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
                    index={char.index}
                    hskLevel={char.hskLevel}
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
