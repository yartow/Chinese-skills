import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home, BookMarked, BookOpen, Search as SearchIcon, Library, Heart,
  ListChecks, Type, PenLine, Brush, BookText, Settings,
} from "lucide-react";
import type { ChineseCharacter } from "@shared/schema";

// userAgent is more reliable than the deprecated navigator.platform
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

const NAV_ITEMS = [
  { id: "daily",    label: "Daily",    desc: "Today's characters",  Icon: Home,       path: "/",        kw: "home daily 每天" },
  { id: "standard", label: "Standard", desc: "Browse all characters", Icon: BookMarked, path: "/standard", kw: "standard browse all" },
  { id: "words",    label: "Words",    desc: "Vocabulary list",      Icon: BookOpen,   path: "/words",   kw: "words vocabulary 词汇 单词" },
  { id: "search",   label: "Search",   desc: "Search characters",   Icon: SearchIcon, path: "/search",  kw: "search find lookup 查找" },
  { id: "browse",   label: "Browse",   desc: "Character browser",   Icon: Library,    path: "/browse",  kw: "browse library" },
  { id: "saved",    label: "Saved",    desc: "Saved items",         Icon: Heart,      path: "/saved",   kw: "saved favorites bookmarks" },
];

const TEST_ITEMS = [
  { id: "choice",      label: "Multiple Choice",  desc: "Choose the right character", Icon: ListChecks, tab: "choice",      kw: "multiple choice quiz 选择" },
  { id: "fill",        label: "Fill in the Blank", desc: "Type the missing character", Icon: Type,       tab: "fill",        kw: "fill blank cloze 填空" },
  { id: "handwriting", label: "Handwriting",       desc: "Draw characters",            Icon: PenLine,    tab: "handwriting", kw: "draw write handwriting 书写" },
  { id: "stroke",      label: "Stroke Order",      desc: "Practice stroke order",      Icon: Brush,      tab: "stroke",      kw: "stroke order 笔顺" },
  { id: "vocabulary",  label: "Vocabulary Quiz",   desc: "Fill in vocabulary words",   Icon: BookText,   tab: "words",       kw: "vocab words vocabulary 词汇" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [, setLocation] = useLocation();

  // Debounce search input for API calls
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Global keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Accept Cmd (Mac) or Ctrl (Windows/Linux) — avoids relying on platform detection
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }

      // ⌘, / Ctrl+, → open preferences
      // Note: in Chrome/Brave on macOS this shortcut is captured by the browser
      // before reaching JavaScript, so it may not fire there.
      if (e.key === ",") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("open-settings"));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data: charResults = [] } = useQuery<ChineseCharacter[]>({
    queryKey: ["/api/characters/search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim()) return [];
      const res = await fetch(`/api/characters/search?q=${encodeURIComponent(debouncedSearch)}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: debouncedSearch.trim().length > 0,
    staleTime: 30_000,
  });

  function go(path: string) {
    setLocation(path);
    setOpen(false);
    setSearch("");
  }

  function openSettings() {
    window.dispatchEvent(new CustomEvent("open-settings"));
    setOpen(false);
    setSearch("");
  }

  return (
    <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <CommandInput
        placeholder="Go to page, search characters…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map(({ id, label, desc, Icon, path, kw }) => (
            <CommandItem
              key={id}
              value={`${label} ${desc} ${kw}`}
              onSelect={() => go(path)}
            >
              <Icon className="shrink-0" />
              <span>{label}</span>
              <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">{desc}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Tests &amp; Quizzes">
          {TEST_ITEMS.map(({ id, label, desc, Icon, tab, kw }) => (
            <CommandItem
              key={id}
              value={`${label} ${desc} test quiz ${kw}`}
              onSelect={() => go(`/test?tab=${tab}`)}
            >
              <Icon className="shrink-0" />
              <span>{label}</span>
              <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">{desc}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Preferences">
          <CommandItem value="settings preferences instellingen" onSelect={openSettings}>
            <Settings className="shrink-0" />
            <span>Preferences</span>
            <span className="ml-auto text-xs text-muted-foreground opacity-60">
              {isMac ? "⌘," : "Ctrl+,"}
            </span>
          </CommandItem>
        </CommandGroup>

        {charResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Characters">
              {charResults.slice(0, 8).map((char) => (
                <CommandItem
                  key={char.index}
                  value={`${char.simplified} ${char.traditional} ${char.pinyin} ${Array.isArray(char.definition) ? char.definition.join(" ") : char.definition}`}
                  onSelect={() => go(`/character/${char.index}`)}
                >
                  <span className="font-serif text-xl w-8 text-center shrink-0">
                    {char.simplified}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm leading-tight">{char.pinyin}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {Array.isArray(char.definition) ? char.definition[0] : char.definition}
                    </span>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">
                    HSK {char.hskLevel}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
