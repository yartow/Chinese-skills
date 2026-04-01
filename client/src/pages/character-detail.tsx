import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useState, useEffect, useRef } from "react";
import CharacterDetailView from "@/components/CharacterDetailView";
import type { ChineseCharacter, UserSettings, CharacterProgress, SavedItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function CharacterDetail() {
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const characterIndex = parseInt(id || "0");

  const { data: character, isLoading: characterLoading } = useQuery<ChineseCharacter>({
    queryKey: ["/api/characters", characterIndex],
  });

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: progress } = useQuery<CharacterProgress>({
    queryKey: ["/api/progress", characterIndex],
  });

  // Local progress state — updates instantly on click so the UI never lags
  const [localProgress, setLocalProgress] = useState({ reading: false, writing: false, radical: false });
  // Debounce ref — rapid clicks accumulate into one API call after 400 ms of inactivity
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from server whenever the server state changes and no edit is pending
  useEffect(() => {
    if (!debounceRef.current) {
      setLocalProgress({
        reading: progress?.reading ?? false,
        writing: progress?.writing ?? false,
        radical: progress?.radical ?? false,
      });
    }
  }, [progress?.reading, progress?.writing, progress?.radical]);

  const { data: savedItems } = useQuery<SavedItem[]>({
    queryKey: ["/api/saved"],
  });

  const toggleSaveMutation = useMutation({
    mutationFn: (item: { type: string; chinese: string; pinyin: string; english: string }) =>
      apiRequest("POST", "/api/saved/toggle", item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved"] });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: (progressData: { characterIndex: number; reading: boolean; writing: boolean; radical: boolean }) =>
      apiRequest("POST", "/api/progress", progressData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress", characterIndex] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress/range"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress/batch"] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: Partial<UserSettings>) =>
      apiRequest("PATCH", "/api/settings", newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  const handleToggleProgress = (type: "reading" | "writing" | "radical") => {
    // Use functional updater so every rapid click sees the latest local state
    setLocalProgress(prev => {
      const next = { ...prev, [type]: !prev[type] };
      // Cancel any pending API call and reschedule with the latest accumulated state
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        updateProgressMutation.mutate({ characterIndex, ...next });
      }, 400);
      return next;
    });
  };

  const handleToggleScript = () => {
    updateSettingsMutation.mutate({ preferTraditional: !isTraditional });
  };

  const isTraditional = settings?.preferTraditional ?? false;
  const savedChinese = new Set((savedItems ?? []).map((i) => i.chinese));

  if (characterLoading || !character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const formattedCharacter = {
    simplified: character.simplified,
    traditional: character.traditional,
    pinyin: character.pinyin,
    pinyin2: character.pinyin2,
    pinyin3: character.pinyin3,
    radical: character.radical || "",
    radicalPinyin: character.radicalPinyin || "",
    definition: Array.isArray(character.definition) ? character.definition : [],
    examples: Array.isArray(character.examples)
      ? character.examples as Array<{ chinese: string; english: string }>
      : [],
    wordExamples: Array.isArray(character.wordExamples)
      ? character.wordExamples as Array<{ word: string; pinyin: string; definition: string; chinese: string; english: string }>
      : [],
  };

  return (
    <CharacterDetailView
      character={formattedCharacter}
      index={character.index}
      hskLevel={character.hskLevel}
      progress={localProgress}
      savedChinese={savedChinese}
      onToggleSave={(item) => toggleSaveMutation.mutate(item)}
      onBack={() => window.history.back()}
      isTraditional={isTraditional}
      onToggleScript={handleToggleScript}
      onToggleReading={() => handleToggleProgress("reading")}
      onToggleWriting={() => handleToggleProgress("writing")}
      onToggleRadical={() => handleToggleProgress("radical")}
      onPrevious={characterIndex > 0 ? () => setLocation(`/character/${characterIndex - 1}`) : undefined}
      onNext={characterIndex < 2999 ? () => setLocation(`/character/${characterIndex + 1}`) : undefined}
    />
  );
}
