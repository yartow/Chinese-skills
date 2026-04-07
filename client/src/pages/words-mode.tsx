import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import WordCard from "@/components/WordCard";
import { ArrowLeft, Filter } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { ChineseWord, WordProgress } from "@shared/schema";

interface FilteredWordsResponse {
  words: ChineseWord[];
  total: number;
}

export default function WordsMode() {
  const [, setLocation] = useLocation();

  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get("page") || "0");
  });
  const [selectedHskLevels, setSelectedHskLevels] = useState<number[]>(() => {
    const str = new URLSearchParams(window.location.search).get("hskLevels");
    return str ? str.split(",").map(Number) : [];
  });
  const [filterUnknown, setFilterUnknown] = useState(() => {
    return new URLSearchParams(window.location.search).get("filterUnknown") === "true";
  });
  const [showFilters, setShowFilters] = useState(false);

  const isFirstRender = useRef(true);
  const PAGE_SIZE = 20;

  // Sync URL with state
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 0) params.set("page", String(currentPage));
    if (selectedHskLevels.length > 0) params.set("hskLevels", selectedHskLevels.join(","));
    if (filterUnknown) params.set("filterUnknown", "true");

    const queryString = params.toString();
    const newPath = queryString ? `/words?${queryString}` : "/words";
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath !== newPath) {
      setLocation(newPath, { replace: true });
    }
  }, [currentPage, selectedHskLevels, filterUnknown]);

  // Reset page on filter change (but not on first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setCurrentPage(0);
  }, [selectedHskLevels, filterUnknown]);

  const { data, isLoading } = useQuery<FilteredWordsResponse>({
    queryKey: ["/api/words/filtered", currentPage, PAGE_SIZE, selectedHskLevels, filterUnknown],
    queryFn: async ({ queryKey }) => {
      const [, page, size, hskLevels, unknown] = queryKey as [string, number, number, number[], boolean];
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(size),
      });
      if (Array.isArray(hskLevels) && hskLevels.length > 0) {
        params.set("hskLevels", hskLevels.join(","));
      }
      if (unknown) params.set("filterUnknown", "true");
      const res = await fetch(`/api/words/filtered?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  const words = data?.words ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const wordIds = words.map((w) => w.id);
  const { data: progressList = [] } = useQuery<WordProgress[]>({
    queryKey: ["/api/words/batch-progress", wordIds.join(",")],
    queryFn: async ({ queryKey }) => {
      const [, idsStr] = queryKey as [string, string];
      if (!idsStr) return [];
      const res = await fetch(`/api/words/batch-progress?wordIds=${idsStr}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: words.length > 0,
  });

  const debounceMap = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  function handleToggleKnown(wordId: number) {
    const cacheKey = ["/api/words/batch-progress", wordIds.join(",")];
    const current = (queryClient.getQueryData<WordProgress[]>(cacheKey) ?? []).find(
      (p) => p.wordId === wordId
    );
    const nowKnown = !(current?.known ?? false);

    // Optimistic update
    queryClient.setQueryData<WordProgress[]>(cacheKey, (old = []) => {
      const idx = old.findIndex((p) => p.wordId === wordId);
      const updated: WordProgress = {
        id: current?.id ?? "",
        userId: current?.userId ?? "",
        wordId,
        known: nowKnown,
        updatedAt: new Date(),
      };
      if (idx >= 0) {
        const arr = [...old];
        arr[idx] = updated;
        return arr;
      }
      return [...old, updated];
    });

    // Debounce the API call
    const existing = debounceMap.current.get(wordId);
    if (existing) clearTimeout(existing);
    debounceMap.current.set(
      wordId,
      setTimeout(async () => {
        debounceMap.current.delete(wordId);
        try {
          await fetch(`/api/progress/words/${wordId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ known: nowKnown }),
          });
          // Re-apply the filter now that the DB is updated
          queryClient.invalidateQueries({
            predicate: (q) => q.queryKey[0] === "/api/words/filtered",
          });
        } catch {
          // best-effort
        }
      }, 400)
    );
  }

  function handleToggleHskLevel(level: number) {
    setSelectedHskLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading…</div>
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
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg sm:text-2xl font-bold truncate">Words</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
              Page {currentPage + 1} of {Math.max(1, totalPages)} · {total} words
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-semibold">Showing {words.length} words</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {words.map((word) => {
                const progress = progressList.find((p) => p.wordId === word.id);
                return (
                  <WordCard
                    key={word.id}
                    word={word.word}
                    traditional={word.traditional}
                    pinyin={word.pinyin}
                    definition={word.definition}
                    hskLevel={word.hskLevel}
                    known={progress?.known ?? false}
                    onToggleKnown={() => handleToggleKnown(word.id)}
                  />
                );
              })}
            </div>

            {words.length === 0 && (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">
                  No words match your current filters. Try adjusting your filter settings.
                </p>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className={showFilters ? undefined : "hidden lg:block"}>
              <Card className="p-6 sticky top-6 space-y-4">
                <h2 className="text-lg font-semibold">Filters</h2>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Show only not known:</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="filter-unknown"
                      checked={filterUnknown}
                      onCheckedChange={() => setFilterUnknown((v) => !v)}
                    />
                    <Label htmlFor="filter-unknown" className="text-sm font-normal cursor-pointer">
                      Hide known words
                    </Label>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Filter by HSK Level:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                      <div key={level} className="flex items-center space-x-2">
                        <Checkbox
                          id={`word-hsk-${level}`}
                          checked={selectedHskLevels.includes(level)}
                          onCheckedChange={() => handleToggleHskLevel(level)}
                        />
                        <Label
                          htmlFor={`word-hsk-${level}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          HSK {level}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
