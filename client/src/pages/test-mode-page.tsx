import FillInBlankQuiz from "@/components/FillInBlankQuiz";

export default function TestModePage() {
  return (
    <div className="py-6">
      <div className="max-w-2xl mx-auto px-4 mb-6">
        <h1 className="text-2xl font-semibold">Test Mode</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Fill in the missing character — press Enter to submit, Enter again for the next question.
        </p>
      </div>
      <FillInBlankQuiz />
    </div>
  );
}
