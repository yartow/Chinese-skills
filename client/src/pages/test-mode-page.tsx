import { useState } from "react";
import FillInBlankQuiz from "@/components/FillInBlankQuiz";
import HandwritingQuiz from "@/components/HandwritingQuiz";
import { Type, PenLine } from "lucide-react";

type QuizTab = "fill" | "handwriting";

export default function TestModePage() {
  const [activeTab, setActiveTab] = useState<QuizTab>("fill");

  return (
    <div className="py-6">
      <div className="max-w-2xl mx-auto px-4 mb-6">
        <h1 className="text-2xl font-semibold">Test Mode</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Practice your Chinese characters.
        </p>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4 border-b">
          <button
            onClick={() => setActiveTab("fill")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${activeTab === "fill"
                ? "border-red-600 text-red-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            <Type className="w-3.5 h-3.5" />
            Fill in blank
          </button>
          <button
            onClick={() => setActiveTab("handwriting")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${activeTab === "handwriting"
                ? "border-red-600 text-red-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            Handwriting
          </button>
        </div>
      </div>

      {activeTab === "fill" && <FillInBlankQuiz />}
      {activeTab === "handwriting" && <HandwritingQuiz />}
    </div>
  );
}
