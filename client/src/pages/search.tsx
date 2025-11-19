import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search as SearchIcon, BookOpen, PenTool, Grid3x3, X } from "lucide-react";
import type { ChineseCharacter, UserSettings, CharacterProgress } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Search() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  const isTraditional = settings?.preferTraditional ?? false;

  const { data: searchResults = [], isLoading } = useQuery<ChineseCharacter[]>({
    queryKey: ["/api/characters/search", activeSearch],
    queryFn: async () => {
      if (!activeSearch.trim()) return [];
      const res = await fetch(`/api/characters/search?q=${encodeURIComponent(activeSearch)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
    enabled: activeSearch.trim() !== "",
  });

  const characterIndices = searchResults.map(c => c.index);
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
    enabled: characterIndices.length > 0,
  });

  const updateProgressMutation = useMutation({
    mutationFn: (progressData: { characterIndex: number; reading: boolean; writing: boolean; radical: boolean }) =>
      apiRequest("POST", "/api/progress", progressData),
    onSuccess: () => {
      // Invalidate all progress queries with a predicate to catch all variants
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          return queryKey[0] === "/api/progress/batch" || 
                 queryKey[0] === "/api/progress/range" ||
                 (typeof queryKey[0] === 'string' && queryKey[0].startsWith('/api/progress'));
        }
      });
    },
  });

  const handleSearch = () => {
    setActiveSearch(searchTerm);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setActiveSearch("");
  };

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

  const getProgress = (characterIndex: number) => {
    return progressList.find((p: CharacterProgress) => p.characterIndex === characterIndex) || {
      reading: false,
      writing: false,
      radical: false,
    };
  };

  const getDisplayCharacter = (char: ChineseCharacter) => {
    if (!isTraditional) {
      return char.simplified;
    }
    
    if (char.traditionalVariants && char.traditionalVariants.length > 0) {
      return char.traditionalVariants.join('');
    }
    
    return char.traditional;
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Search Characters</h1>
          <Button
            variant="outline"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            Back to Home
          </Button>
        </div>

        <div className="mb-6 flex gap-2">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="Search by character, pinyin, or meaning..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              data-testid="input-search"
              className="pr-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={handleClearSearch}
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            disabled={!searchTerm.trim()}
            data-testid="button-search"
          >
            <SearchIcon className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>

        {isLoading && (
          <div className="text-center text-muted-foreground py-12">
            Searching...
          </div>
        )}

        {!isLoading && activeSearch && searchResults.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            No characters found for "{activeSearch}"
          </div>
        )}

        {!isLoading && searchResults.length > 0 && (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              Found {searchResults.length} character{searchResults.length !== 1 ? 's' : ''}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {searchResults.map((char) => {
                const progress = getProgress(char.index);
                return (
                  <Card
                    key={char.index}
                    className="p-4 hover-elevate active-elevate-2 cursor-pointer"
                    onClick={() => setLocation(`/character/${char.index}`)}
                    data-testid={`card-character-${char.index}`}
                  >
                    <div className="text-center">
                      <div className="text-5xl font-serif mb-2" style={{ fontFamily: 'Kaiti' }}>
                        {getDisplayCharacter(char)}
                      </div>
                      <div className="text-sm text-muted-foreground mb-3">
                        {char.pinyin}
                      </div>
                      <div className="flex justify-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStar(char.index, "reading");
                          }}
                          className={`transition-colors ${progress.reading ? 'text-green-500' : 'text-muted-foreground'}`}
                          data-testid={`button-reading-${char.index}`}
                          title="Reading mastery"
                        >
                          <BookOpen className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStar(char.index, "writing");
                          }}
                          className={`transition-colors ${progress.writing ? 'text-green-500' : 'text-muted-foreground'}`}
                          data-testid={`button-writing-${char.index}`}
                          title="Writing mastery"
                        >
                          <PenTool className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStar(char.index, "radical");
                          }}
                          className={`transition-colors ${progress.radical ? 'text-green-500' : 'text-muted-foreground'}`}
                          data-testid={`button-radical-${char.index}`}
                          title="Radical mastery"
                        >
                          <Grid3x3 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {!activeSearch && (
          <div className="text-center text-muted-foreground py-12">
            <SearchIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Enter a character, pinyin, or meaning to search</p>
            <p className="text-sm mt-2">Examples: 学, xue, learn</p>
          </div>
        )}
      </div>
    </div>
  );
}
