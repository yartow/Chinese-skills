import TestMode from "../TestMode";

export default function TestModeExample() {
  return (
    <div className="min-h-screen bg-background p-6">
      <TestMode onStartTest={(type, index) => console.log(`Starting ${type} test at index ${index}`)} />
    </div>
  );
}
