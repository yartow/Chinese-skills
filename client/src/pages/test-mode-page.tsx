import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FillInBlankQuiz from "@/components/FillInBlankQuiz";
import HandwritingQuiz from "@/components/HandwritingQuiz";
import { PenLine, Type } from "lucide-react";

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
        <Tabs defaultValue="fill">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="fill" className="flex-1 gap-2">
              <Type className="w-4 h-4" />
              Fill in the blank
            </TabsTrigger>
            <TabsTrigger value="write" className="flex-1 gap-2">
              <PenLine className="w-4 h-4" />
              Write the character
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fill">
            <FillInBlankQuiz />
          </TabsContent>

          <TabsContent value="write">
            <HandwritingQuiz />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
