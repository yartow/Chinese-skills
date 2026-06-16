import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import StarRating from "./StarRating";
import { cn } from "@/lib/utils";

interface CharacterCardProps {
  character: string;
  index: number;
  hskLevel?: number;
  reading: boolean;
  writing: boolean;
  radical: boolean;
  onToggleReading: () => void;
  onToggleWriting: () => void;
  onToggleRadical: () => void;
  onClick: () => void;
  className?: string;
  /** Selection mode — provide both to enable the selection circle */
  selected?: boolean;
  onSelect?: (shiftKey: boolean) => void;
  /** When true, show a small badge indicating multiple traditional forms exist */
  hasTraditionalAmbiguity?: boolean;
}

export default function CharacterCard({
  character,
  index,
  hskLevel,
  reading,
  writing,
  radical,
  onToggleReading,
  onToggleWriting,
  onToggleRadical,
  onClick,
  className,
  selected,
  onSelect,
  hasTraditionalAmbiguity,
}: CharacterCardProps) {
  return (
    <Card
      className={cn(
        "p-6 flex flex-col items-center gap-4 cursor-pointer hover-elevate transition-all relative",
        selected && "ring-2 ring-primary ring-offset-1",
        className
      )}
      onClick={onClick}
      data-testid={`card-character-${character}`}
    >
      {onSelect ? (
        <button
          className={cn(
            "absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
            selected
              ? "bg-primary border-primary"
              : "bg-background/80 border-muted-foreground/40 hover:border-primary"
          )}
          onClick={(e) => { e.stopPropagation(); onSelect(e.shiftKey); }}
          aria-label={selected ? "Deselect character" : "Select character"}
        >
          {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
        </button>
      ) : (
        <span
          className="absolute top-2 left-3 text-xs text-muted-foreground font-mono select-none"
          data-testid={`text-index-${index}`}
        >
          #{index}
        </span>
      )}
      {hskLevel !== undefined && hskLevel > 0 && (
        <span
          className="absolute top-2 right-3 text-xs text-muted-foreground font-medium select-none"
          data-testid={`text-hsk-${index}`}
        >
          HSK {hskLevel}
        </span>
      )}
      {hasTraditionalAmbiguity && (
        <span
          className="absolute top-2 right-3 mt-5 w-4 h-4 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-[9px] font-bold flex items-center justify-center select-none"
          title="Multiple traditional forms"
        >
          2
        </span>
      )}
      <div className="text-8xl font-chinese text-center" data-testid={`text-character-${character}`}>
        {character}
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <StarRating
          reading={reading}
          writing={writing}
          radical={radical}
          onToggleReading={onToggleReading}
          onToggleWriting={onToggleWriting}
          onToggleRadical={onToggleRadical}
        />
      </div>
    </Card>
  );
}
