import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Copy, Check } from "lucide-react";
import type { UserSettings } from "@shared/schema";

interface BrowseCharacter {
  index: number;
  simplified: string;
  traditional: string;
  pinyin: string;
  hskLevel: number;
  lesson: number | null;
}

interface CharacterBrowserProps {
  onSelectIndex?: (index: number) => void;
}

const PAGE_SIZE = 60;

export default function CharacterBrowser({ onSelectIndex }: CharacterBrowserProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const { data: settings } = useQuery<UserSettings>({ queryKey: ["/api/settings"] });
  const isTraditional = settings?.preferTraditional ?? false;

  const { data: characters = [], isLoading } = useQuery<BrowseCharacter[]>({
    queryKey: ["/api/characters/browse"],
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return characters;
    const numQ = parseInt(q);
    return characters.filter((c) => {
      if (!isNaN(numQ) && c.index === numQ) return true;
      if (c.simplified.includes(q) || c.traditional.includes(q)) return true;
      if (c.pinyin.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [characters, search]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pageChars = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleCopy = (index: number) => {
    navigator.clipboard.writeText(String(index)).catch(() => {});
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading characters...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by character, pinyin, or index number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-browser-search"
          />
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filtered.length.toLocaleString()} characters
        </span>
      </div>

      <div className="flex-1 overflow-auto min-h-0 border rounded-md">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b z-10">
            <tr>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground w-14">Index</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground w-12">Char</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">Pinyin</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground w-12">HSK</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground w-16 hidden sm:table-cell">Lesson</th>
              <th className="w-14 py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {pageChars.map((c) => (
              <tr key={c.index} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                <td className="py-2 px-3 tabular-nums text-muted-foreground" data-testid={`text-index-${c.index}`}>
                  {c.index}
                </td>
                <td className="py-2 px-3 text-xl font-chinese" data-testid={`text-char-${c.index}`}>
                  {isTraditional ? c.traditional : c.simplified}
                </td>
                <td className="py-2 px-3" data-testid={`text-pinyin-${c.index}`}>
                  {c.pinyin}
                </td>
                <td className="py-2 px-3">
                  <Badge variant="outline" className="text-xs font-normal">{c.hskLevel}</Badge>
                </td>
                <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell" data-testid={`text-lesson-${c.index}`}>
                  {c.lesson !== null ? c.lesson : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="py-2 px-3">
                  {onSelectIndex ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSelectIndex(c.index)}
                      data-testid={`button-use-index-${c.index}`}
                    >
                      Use
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCopy(c.index)}
                      title={`Copy index ${c.index}`}
                      data-testid={`button-copy-index-${c.index}`}
                    >
                      {copiedIndex === c.index ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No characters match your search.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            data-testid="button-browser-prev"
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {safePage + 1} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            data-testid="button-browser-next"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
