import { useState } from "react";
import { useSearch } from "wouter";
import MultipleChoiceQuiz from "@/components/MultipleChoiceQuiz";
import FillInBlankQuiz from "@/components/FillInBlankQuiz";
import HandwritingQuiz from "@/components/HandwritingQuiz";
import StrokeOrderQuiz from "@/components/StrokeOrderQuiz";
import WordQuiz from "@/components/WordQuiz";
import { ListChecks, Type, PenLine, Brush, BookText } from "lucide-react";

type QuizTab = "choice" | "fill" | "handwriting" | "stroke" | "words";

const TABS: { id: QuizTab; label: string; Icon: React.ElementType }[] = [
  { id: "choice",      label: "Multiple choice", Icon: ListChecks },
  { id: "fill",        label: "Fill in blank",   Icon: Type       },
  { id: "handwriting", label: "Handwriting",      Icon: PenLine    },
  { id: "stroke",      label: "Stroke order",     Icon: Brush      },
  { id: "words",       label: "Vocabulary",       Icon: BookText   },
];

const VALID_TABS: QuizTab[] = ["choice", "fill", "handwriting", "stroke", "words"];

export default function TestModePage() {
  const searchString = useSearch();
  const initialTab = new URLSearchParams(searchString).get("tab") as QuizTab | null;
  const [activeTab, setActiveTab] = useState<QuizTab>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : "choice"
  );

  return (
    <div className="py-6">
      <div className="max-w-2xl mx-auto px-4 mb-6">
        <h1 className="text-2xl font-semibold">Test Mode</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Practice your Chinese characters.
        </p>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4 border-b overflow-x-auto">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
                ${activeTab === id
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "choice"      && <MultipleChoiceQuiz />}
      {activeTab === "fill"        && <FillInBlankQuiz />}
      {activeTab === "handwriting" && <HandwritingQuiz />}
      {activeTab === "stroke"      && <StrokeOrderQuiz />}
      {activeTab === "words"       && <WordQuiz />}
    </div>
  );
}
