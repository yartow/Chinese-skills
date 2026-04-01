import { useState } from "react";
import FillInBlankQuiz from "@/components/FillInBlankQuiz";
import HandwritingQuiz from "@/components/HandwritingQuiz";
import StrokeOrderQuiz from "@/components/StrokeOrderQuiz";

const TABS = [
  { id: "fill", label: "Fill in the Blank" },
  { id: "handwriting", label: "Handwriting" },
  { id: "stroke", label: "Stroke Order" },
] as const;

type TabId = typeof TABS[number]["id"];

const DESCRIPTIONS: Record<TabId, string> = {
  fill: "Fill in the missing character — press Enter to submit, Enter again for the next question.",
  handwriting: "Draw the missing character freehand — tap your character from the recognized candidates.",
  stroke: "Trace each stroke of the missing character in the correct order.",
};

export default function TestModePage() {
  const [activeTab, setActiveTab] = useState<TabId>("fill");

  return (
    <div className="py-6">
      <div className="max-w-2xl mx-auto px-4 mb-6">
        <h1 className="text-2xl font-semibold">Test Mode</h1>
        <p className="text-muted-foreground text-sm mt-1">{DESCRIPTIONS[activeTab]}</p>

        <div className="flex gap-1 mt-4 border-b">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
                ${activeTab === tab.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "fill" && <FillInBlankQuiz />}
      {activeTab === "handwriting" && <HandwritingQuiz />}
      {activeTab === "stroke" && <StrokeOrderQuiz />}
    </div>
  );
}
