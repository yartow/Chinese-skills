import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import CharacterDetailView from "@/components/CharacterDetailView";
import type { ChineseCharacter, UserSettings } from "@shared/schema";

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

  const isTraditional = settings?.preferTraditional ?? false;

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
    radical: character.radical,
    radicalPinyin: character.radicalPinyin,
    definition: Array.isArray(character.definition) ? character.definition : [],
    examples: Array.isArray(character.examples) 
      ? character.examples as Array<{ chinese: string; english: string }>
      : [],
  };

  return (
    <CharacterDetailView
      character={formattedCharacter}
      onBack={() => setLocation("/")}
      isTraditional={isTraditional}
      onToggleScript={() => {}}
    />
  );
}
