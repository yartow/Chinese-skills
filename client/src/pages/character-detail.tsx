import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
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
      // Invalidate the current character's progress
      queryClient.invalidateQueries({ queryKey: ["/api/progress", characterIndex] });
      // Invalidate all progress queries so Daily Mode and Standard Mode show updated state
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
    const currentProgress = progress || { reading: false, writing: false, radical: false };
    updateProgressMutation.mutate({
      characterIndex,
      reading: type === "reading" ? !currentProgress.reading : currentProgress.reading,
      writing: type === "writing" ? !currentProgress.writing : currentProgress.writing,
      radical: type === "radical" ? !currentProgress.radical : currentProgress.radical,
    });
  };

  const handleToggleScript = () => {
    updateSettingsMutation.mutate({
      preferTraditional: !isTraditional,
    });
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

  const handleBack = () => {
    // Use browser's history to go back to previous page
    window.history.back();
  };

  return (
    <CharacterDetailView
      character={formattedCharacter}
      progress={progress || { reading: false, writing: false, radical: false }}
      savedChinese={savedChinese}
      onToggleSave={(item) => toggleSaveMutation.mutate(item)}
      onBack={handleBack}
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
