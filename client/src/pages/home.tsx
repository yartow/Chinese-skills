import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import CharacterCard from "@/components/CharacterCard";
import ScriptToggle from "@/components/ScriptToggle";
import SettingsPanel from "@/components/SettingsPanel";
import { Settings, LogOut } from "lucide-react";

interface Character {
  id: number;
  simplified: string;
  traditional: string;
  reading: boolean;
  writing: boolean;
  radical: boolean;
}

interface HomePageProps {
  onCharacterClick: (id: number) => void;
  onLogout: () => void;
}

export default function HomePage({ onCharacterClick, onLogout }: HomePageProps) {
  const [isTraditional, setIsTraditional] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(120);
  const [dailyCharCount, setDailyCharCount] = useState(5);
  const [showSettings, setShowSettings] = useState(false);

  const mockCharacters: Character[] = [
    { id: 120, simplified: "学", traditional: "學", reading: true, writing: false, radical: true },
    { id: 121, simplified: "生", traditional: "生", reading: true, writing: true, radical: false },
    { id: 122, simplified: "中", traditional: "中", reading: false, writing: false, radical: false },
    { id: 123, simplified: "国", traditional: "國", reading: true, writing: false, radical: false },
    { id: 124, simplified: "语", traditional: "語", reading: false, writing: true, radical: true },
  ];

  const [characters, setCharacters] = useState(mockCharacters);

  const toggleStarForCharacter = (id: number, type: "reading" | "writing" | "radical") => {
    setCharacters((prev) =>
      prev.map((char) =>
        char.id === id ? { ...char, [type]: !char[type] } : char
      )
    );
  };

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
            <ScriptToggle isTraditional={isTraditional} onToggle={setIsTraditional} />
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
              onClick={onLogout}
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
              onLevelChange={setCurrentLevel}
              onDailyCharCountChange={setDailyCharCount}
            />
          </Card>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4">
            Current Characters (Index {currentLevel} - {currentLevel + 4})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {characters.map((char) => (
              <CharacterCard
                key={char.id}
                character={isTraditional ? char.traditional : char.simplified}
                reading={char.reading}
                writing={char.writing}
                radical={char.radical}
                onToggleReading={() => toggleStarForCharacter(char.id, "reading")}
                onToggleWriting={() => toggleStarForCharacter(char.id, "writing")}
                onToggleRadical={() => toggleStarForCharacter(char.id, "radical")}
                onClick={() => onCharacterClick(char.id)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
