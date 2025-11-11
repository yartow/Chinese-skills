import { useState } from "react";
import CharacterCard from "../CharacterCard";

export default function CharacterCardExample() {
  const [reading, setReading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [radical, setRadical] = useState(true);

  return (
    <div className="p-8 flex items-center justify-center">
      <div className="w-64">
        <CharacterCard
          character="学"
          reading={reading}
          writing={writing}
          radical={radical}
          onToggleReading={() => setReading(!reading)}
          onToggleWriting={() => setWriting(!writing)}
          onToggleRadical={() => setRadical(!radical)}
          onClick={() => console.log("Character clicked")}
        />
      </div>
    </div>
  );
}
