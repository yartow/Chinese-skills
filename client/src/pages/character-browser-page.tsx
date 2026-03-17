import CharacterBrowser from "@/components/CharacterBrowser";

export default function CharacterBrowserPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col" style={{ height: "calc(100vh - 57px)" }}>
      <h2 className="text-2xl font-semibold mb-4">Character Browser</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Browse all 3000 characters. Copy an index number to use it as a starting point in Test Mode.
      </p>
      <div className="flex-1 min-h-0">
        <CharacterBrowser />
      </div>
    </div>
  );
}
