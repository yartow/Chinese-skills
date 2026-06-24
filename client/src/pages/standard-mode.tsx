import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CharacterCard from "@/components/CharacterCard";
import ProgressFilter from "@/components/ProgressFilter";
import { ArrowLeft, Filter, ArrowRight, BookOpen, PenTool, Grid3x3, X, Check } from "lucide-react";
import { apiRequest, authenticatedFetch, queryClient } from "@/lib/queryClient";
import { enqueuePost } from "@/lib/offlineQueue";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { cn } from "@/lib/utils";
import type { UserSettings, ChineseCharacter, CharacterProgress } from "@shared/schema";

interface FilteredCharactersResponse {
  characters: ChineseCharacter[];
  total: number;
}

export default function StandardMode() {
  useActivityTracker("standard");
  const [, setLocation] = useLocation();

  // Read directly from window.location.search so the value is always the real
  // browser URL at mount time — Wouter's location value may lag behind on
  // popstate (back-navigation) in some rendering cycles.
  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get('page') || '0');
  });
  const [filterReading, setFilterReading] = useState(() => {
    return new URLSearchParams(window.location.search).get('filterReading') === 'true';
  });
  const [filterWriting, setFilterWriting] = useState(() => {
    return new URLSearchParams(window.location.search).get('filterWriting') === 'true';
  });
  const [filterRadical, setFilterRadical] = useState(() => {
    return new URLSearchParams(window.location.search).get('filterRadical') === 'true';
  });
  const [selectedHskLevels, setSelectedHskLevels] = useState<number[]>(() => {
    const hskLevelsStr = new URLSearchParams(window.location.search).get('hskLevels');
    return hskLevelsStr ? hskLevelsStr.split(',').map(Number) : [];
  });
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(() => {
    const v = new URLSearchParams(window.location.search).get('sourceId');
    return v ? parseInt(v) : null;
  });
  const [selectedClassId, setSelectedClassId] = useState<number | null>(() => {
    const v = new URLSearchParams(window.location.search).get('classId');
    return v ? parseInt(v) : null;
  });
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(() => {
    const v = new URLSearchParams(window.location.search).get('lessonId');
    return v ? parseInt(v) : null;
  });
  const [filterCore, setFilterCore] = useState(() =>
    new URLSearchParams(window.location.search).get('filterCore') === 'true'
  );
  const [filterOther, setFilterOther] = useState(() =>
    new URLSearchParams(window.location.search).get('filterOther') === 'true'
  );
  const [showFilters, setShowFilters] = useState(false);
  const [jumpInput, setJumpInput] = useState("");
  const [jumpFocused, setJumpFocused] = useState(false);

  // Skip the page-reset effect on first render — filters were restored from
  // the URL, they haven't actually "changed".
  const isFirstRender = useRef(true);

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: sources = [] } = useQuery<{ id: number; name: string }[]>({ queryKey: ["/api/sources"] });
  const { data: allClasses = [] } = useQuery<{ id: number; name: string; sourceId: number }[]>({ queryKey: ["/api/classes"] });
  const { data: allLessons = [] } = useQuery<{ id: number; lesson: string; classId: number }[]>({ queryKey: ["/api/lessons"] });

  const pageSize = settings?.standardModePageSize ?? 20;
  const isTraditional = settings?.preferTraditional ?? false;
  const advancedEditMode = settings?.advancedEditMode ?? false;

  // ─── Batch selection state ───────────────────────────────────────────────
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const lastClickedPos = useRef<number | null>(null);
  const batchInFlight = useRef(false);

  // Keep the URL in sync with filter/page state.
  // Use replaceState (replace: true) so filter changes never push extra entries
  // onto the history stack — pressing back from a character detail page always
  // returns to standard mode with exactly the right URL.
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 0) params.set('page', String(currentPage));
    if (filterReading) params.set('filterReading', 'true');
    if (filterWriting) params.set('filterWriting', 'true');
    if (filterRadical) params.set('filterRadical', 'true');
    if (selectedHskLevels.length > 0) params.set('hskLevels', selectedHskLevels.join(','));
    if (selectedSourceId) params.set('sourceId', String(selectedSourceId));
    if (selectedClassId) params.set('classId', String(selectedClassId));
    if (selectedLessonId) params.set('lessonId', String(selectedLessonId));
    if (filterCore) params.set('filterCore', 'true');
    if (filterOther) params.set('filterOther', 'true');

    const queryString = params.toString();
    const newPath = queryString ? `/standard?${queryString}` : '/standard';
    const currentPath = window.location.pathname + window.location.search;

    if (currentPath !== newPath) {
      setLocation(newPath, { replace: true });
    }
  }, [currentPage, filterReading, filterWriting, filterRadical, selectedHskLevels, selectedSourceId, selectedClassId, selectedLessonId, filterCore, filterOther]);

  // Reset to first page when filters change — but not on the initial render,
  // because the filters were already restored from the URL.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setCurrentPage(0);
  }, [filterReading, filterWriting, filterRadical, selectedHskLevels, selectedLessonId, filterCore, filterOther]);

  // Clear selection when navigating to a different page or changing filters
  useEffect(() => {
    setSelectedIndices(new Set());
    lastClickedPos.current = null;
  }, [currentPage, filterReading, filterWriting, filterRadical, selectedHskLevels, selectedLessonId, filterCore, filterOther]);

  const { data, isLoading } = useQuery<FilteredCharactersResponse>({
    queryKey: [
      "/api/characters/filtered",
      currentPage,
      pageSize,
      selectedHskLevels,
      filterReading,
      filterWriting,
      filterRadical,
      selectedLessonId,
      filterCore,
      filterOther,
    ],
    queryFn: async ({ queryKey }) => {
      // Destructure fresh values from queryKey instead of closing over stale component state
      const [_, page, size, hskLevels, reading, writing, radical, lessonId, core, other] = queryKey;

      const queryParams = new URLSearchParams({
        page: String(page),
        pageSize: String(size),
      });

      if (Array.isArray(hskLevels) && hskLevels.length > 0) {
        queryParams.set('hskLevels', hskLevels.join(','));
      }
      if (reading) queryParams.set('filterReading', 'true');
      if (writing) queryParams.set('filterWriting', 'true');
      if (radical) queryParams.set('filterRadical', 'true');
      if (lessonId) queryParams.set('lessonId', String(lessonId));
      if (core) queryParams.set('filterCore', 'true');
      if (other) queryParams.set('filterOther', 'true');

      const res = await authenticatedFetch(`/api/characters/filtered?${queryParams.toString()}`);
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    placeholderData: keepPreviousData,
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
      
      const res = await authenticatedFetch(`/api/progress/batch?indices=${indicesString}`);
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: characters.length > 0,
  });

  // Per-character debounce timers — rapid clicks accumulate into one API call
  const debounceMap = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const updateProgressMutation = useMutation({
    mutationFn: (progressData: { characterIndex: number; reading: boolean; writing: boolean; radical: boolean }) =>
      apiRequest("POST", "/api/progress", progressData),
    onError: (_err, variables) => {
      enqueuePost(variables);
    },
    onSettled: () => {
      // Only invalidate stats and individual character queries — NOT the batch/range
      // display queries. Those are kept accurate via optimistic setQueryData updates,
      // and refetching them here races with a second click's optimistic update,
      // causing the "click one, nothing happens; click another, previous one toggles" bug.
      queryClient.invalidateQueries({ predicate: (query) =>
        query.queryKey[0] === "/api/progress/stats" ||
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

  // ─── Selection handlers ──────────────────────────────────────────────────

  const handleSelectChar = (charIndex: number, pos: number, shiftKey: boolean) => {
    if (shiftKey && lastClickedPos.current !== null) {
      const start = Math.min(lastClickedPos.current, pos);
      const end = Math.max(lastClickedPos.current, pos);
      setSelectedIndices(prev => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          if (characters[i]) next.add(characters[i].index);
        }
        return next;
      });
    } else {
      setSelectedIndices(prev => {
        const next = new Set(prev);
        if (next.has(charIndex)) { next.delete(charIndex); } else { next.add(charIndex); }
        return next;
      });
      lastClickedPos.current = pos;
    }
  };

  const handleSelectAll = () => {
    if (selectedIndices.size === characters.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(characters.map(c => c.index)));
    }
  };

  const handleBatchToggle = async (field: 'reading' | 'writing' | 'radical') => {
    if (selectedIndices.size === 0 || batchInFlight.current) return;
    batchInFlight.current = true;
    const cacheKey = ["/api/progress/batch", characterIndices.join(',')];
    const currentList = queryClient.getQueryData<CharacterProgress[]>(cacheKey) ?? [];
    const selectedArr = Array.from(selectedIndices);

    const allOn = selectedArr.every(idx => {
      const p = currentList.find(p => p.characterIndex === idx);
      return p?.[field] ?? false;
    });
    const newValue = !allOn;

    // Optimistic update
    queryClient.setQueryData<CharacterProgress[]>(cacheKey, (old = []) => {
      const map = new Map(old.map(p => [p.characterIndex, p]));
      for (const idx of selectedArr) {
        const existing = map.get(idx);
        map.set(idx, existing
          ? { ...existing, [field]: newValue }
          : { id: '', userId: '', characterIndex: idx, reading: false, writing: false, radical: false, updatedAt: new Date(), [field]: newValue }
        );
      }
      return Array.from(map.values());
    });

    try {
      await fetch('/api/progress/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          updates: selectedArr.map(idx => {
            const current = currentList.find(p => p.characterIndex === idx);
            return {
              characterIndex: idx,
              reading: field === 'reading' ? newValue : (current?.reading ?? false),
              writing: field === 'writing' ? newValue : (current?.writing ?? false),
              radical: field === 'radical' ? newValue : (current?.radical ?? false),
            };
          }),
        }),
      });
      queryClient.invalidateQueries({ predicate: q =>
        q.queryKey[0] === '/api/progress/batch' ||
        q.queryKey[0] === '/api/progress/range' ||
        q.queryKey[0] === '/api/progress/stats' ||
        (q.queryKey[0] === '/api/progress' && typeof q.queryKey[1] === 'number')
      });
    } catch {
      // best-effort; optimistic update stays
    } finally {
      batchInFlight.current = false;
    }
  };

  // Compute per-field state across selected characters for the batch action bar
  const selectedProgressList = Array.from(selectedIndices).map(idx =>
    progressList.find(p => p.characterIndex === idx)
  );
  const batchAllOn = {
    reading: selectedProgressList.length > 0 && selectedProgressList.every(p => p?.reading ?? false),
    writing: selectedProgressList.length > 0 && selectedProgressList.every(p => p?.writing ?? false),
    radical: selectedProgressList.length > 0 && selectedProgressList.every(p => p?.radical ?? false),
  };

  const handleToggleHskLevel = (level: number) => {
    setSelectedHskLevels((prev) =>
      prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level]
    );
  };

  const handleSelectSource = (id: number | null) => {
    setSelectedSourceId(id);
    setSelectedClassId(null);
    setSelectedLessonId(null);
    if (!id) { setFilterCore(false); setFilterOther(false); }
  };
  const handleSelectClass = (id: number | null) => {
    setSelectedClassId(id);
    setSelectedLessonId(null);
  };
  const handleSelectLesson = (id: number | null) => {
    setSelectedLessonId(id);
    if (!id) { setFilterCore(false); setFilterOther(false); }
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
        {/* Mobile filter panel — shown above the character list when toggled */}
        {showFilters && (
          <div className="lg:hidden mb-6">
            <Card className="p-6">
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
                sources={sources}
                classes={allClasses}
                lessons={allLessons}
                selectedSourceId={selectedSourceId}
                selectedClassId={selectedClassId}
                selectedLessonId={selectedLessonId}
                filterCore={filterCore}
                filterOther={filterOther}
                onSelectSource={handleSelectSource}
                onSelectClass={handleSelectClass}
                onSelectLesson={handleSelectLesson}
                onToggleFilterCore={() => setFilterCore(v => !v)}
                onToggleFilterOther={() => setFilterOther(v => !v)}
              />
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {advancedEditMode && (
                    <button
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                        selectedIndices.size === characters.length && characters.length > 0
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/40 hover:border-primary bg-background"
                      )}
                      onClick={handleSelectAll}
                      title="Select all on this page"
                    >
                      {selectedIndices.size === characters.length && characters.length > 0 && (
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      )}
                    </button>
                  )}
                  <h2 className="text-xl font-semibold">
                    Showing {characters.length} characters
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">Go to index:</span>
                  <Input
                    type="number"
                    min={1}
                    max={3000}
                    placeholder="e.g. 500"
                    value={jumpInput}
                    onChange={(e) => setJumpInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleJumpToIndex()}
                    onFocus={() => setJumpFocused(true)}
                    onBlur={() => setJumpFocused(false)}
                    className="w-28"
                    data-testid="input-jump-to-index"
                  />
                  {jumpFocused && (
                    <Button
                      variant="outline"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleJumpToIndex}
                      disabled={jumpInput === ""}
                      data-testid="button-jump-to-index"
                      className="gap-1"
                    >
                      Go
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
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

            {/* Batch action bar — visible when ≥1 character is selected */}
            {advancedEditMode && selectedIndices.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
                <span className="font-medium text-sm">{selectedIndices.size} selected</span>
                <div className="flex gap-1.5 ml-1">
                  <Button
                    variant={batchAllOn.reading ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleBatchToggle('reading')}
                    className="gap-1 h-7 px-2 text-xs min-w-[64px]"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Read
                  </Button>
                  <Button
                    variant={batchAllOn.writing ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleBatchToggle('writing')}
                    className="gap-1 h-7 px-2 text-xs min-w-[64px]"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    Write
                  </Button>
                  <Button
                    variant={batchAllOn.radical ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleBatchToggle('radical')}
                    className="gap-1 h-7 px-2 text-xs min-w-[64px]"
                  >
                    <Grid3x3 className="w-3.5 h-3.5" />
                    Radical
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSelectedIndices(new Set()); lastClickedPos.current = null; }}
                  className="ml-auto h-7 w-7 p-0"
                  title="Clear selection"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {characters.map((char, charPos) => {
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
                    onClick={
                      advancedEditMode && selectedIndices.size > 0
                        ? () => handleSelectChar(char.index, charPos, false)
                        : () => setLocation(`/character/${char.index}`)
                    }
                    selected={advancedEditMode ? selectedIndices.has(char.index) : undefined}
                    onSelect={advancedEditMode ? (shiftKey) => handleSelectChar(char.index, charPos, shiftKey) : undefined}
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

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={!hasPrevious}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!hasNext}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-1">
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
                sources={sources}
                classes={allClasses}
                lessons={allLessons}
                selectedSourceId={selectedSourceId}
                selectedClassId={selectedClassId}
                selectedLessonId={selectedLessonId}
                filterCore={filterCore}
                filterOther={filterOther}
                onSelectSource={handleSelectSource}
                onSelectClass={handleSelectClass}
                onSelectLesson={handleSelectLesson}
                onToggleFilterCore={() => setFilterCore(v => !v)}
                onToggleFilterOther={() => setFilterOther(v => !v)}
              />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
