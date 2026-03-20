import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MultipleChoiceQuiz from "@/components/MultipleChoiceQuiz";
import FillInBlankQuiz from "@/components/FillInBlankQuiz";
import HandwritingQuiz from "@/components/HandwritingQuiz";
import { ListChecks, Type, PenLine } from "lucide-react";

export default function TestModePage() {
  return (
    <div className="py-6">
      <div className="max-w-2xl mx-auto px-4 mb-6">
        <h1 className="text-2xl font-semibold">Test Mode</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Practice reading and writing Chinese characters.
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        <Tabs defaultValue="choice">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="choice" className="flex-1 gap-1.5 text-xs sm:text-sm">
              <ListChecks className="w-4 h-4 shrink-0" />
              <span>Multiple choice</span>
            </TabsTrigger>
            <TabsTrigger value="fill" className="flex-1 gap-1.5 text-xs sm:text-sm">
              <Type className="w-4 h-4 shrink-0" />
              <span>Fill in blank</span>
            </TabsTrigger>
            <TabsTrigger value="write" className="flex-1 gap-1.5 text-xs sm:text-sm">
              <PenLine className="w-4 h-4 shrink-0" />
              <span>Handwriting</span>
            </TabsTrigger>
          </TabsList>

          {/* forceMount keeps each quiz mounted across tab switches, preserving local state */}
          <TabsContent value="choice" forceMount className="data-[state=inactive]:hidden">
            <MultipleChoiceQuiz />
          </TabsContent>
          <TabsContent value="fill" forceMount className="data-[state=inactive]:hidden">
            <FillInBlankQuiz />
          </TabsContent>
          <TabsContent value="write" forceMount className="data-[state=inactive]:hidden">
            <HandwritingQuiz />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
