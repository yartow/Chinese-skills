import TestMode from "@/components/TestMode";

export default function TestModePage() {
  return <TestMode onStartTest={(type, index) => console.log(`Test: ${type} at ${index}`)} />;
}
