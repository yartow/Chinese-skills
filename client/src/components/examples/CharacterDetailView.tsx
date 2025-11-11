import { useState } from "react";
import CharacterDetailView from "../CharacterDetailView";

export default function CharacterDetailViewExample() {
  const [isTraditional, setIsTraditional] = useState(false);

  const mockCharacter = {
    simplified: "学",
    traditional: "學",
    pinyin: "xué",
    radical: "子",
    radicalPinyin: "zǐ",
    definition: ["to study", "to learn", "school", "knowledge"],
    examples: [
      {
        chinese: "我在学习中文。",
        english: "I am studying Chinese.",
      },
      {
        chinese: "他是一个好学生。",
        english: "He is a good student.",
      },
      {
        chinese: "这所学校很大。",
        english: "This school is very large.",
      },
      {
        chinese: "学无止境。",
        english: "Learning is endless.",
      },
      {
        chinese: "我们要好好学习。",
        english: "We should study hard.",
      },
    ],
  };

  return (
    <CharacterDetailView
      character={mockCharacter}
      onBack={() => console.log("Back clicked")}
      isTraditional={isTraditional}
      onToggleScript={setIsTraditional}
    />
  );
}
