import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { HSK_COLORS } from "./quizTypes";

interface WordCardProps {
  word: string;
  traditional?: string;
  pinyin: string;
  definition: string[];
  hskLevel: number;
  known: boolean;
  onToggleKnown: () => void;
  className?: string;
}

export default function WordCard({
  word,
  traditional,
  pinyin,
  definition,
  hskLevel,
  known,
  onToggleKnown,
  className,
}: WordCardProps) {
  return (
    <Card
      className={cn(
        "p-4 flex flex-col gap-2 relative select-none",
        known && "opacity-60",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif leading-none">{word}</span>
            {traditional && traditional !== word && (
              <span className="text-lg font-serif text-muted-foreground">{traditional}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{pinyin}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${HSK_COLORS[hskLevel] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
          {hskLevel === 0 ? "Unknown" : `HSK ${hskLevel}`}
        </span>
      </div>

      <p className="text-sm text-muted-foreground leading-snug line-clamp-2">
        {definition.slice(0, 2).join(" · ")}
      </p>

      <div
        className="flex items-center gap-2 mt-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          id={`known-${word}`}
          checked={known}
          onCheckedChange={onToggleKnown}
        />
        <label
          htmlFor={`known-${word}`}
          className="text-xs text-muted-foreground cursor-pointer"
        >
          Known
        </label>
      </div>
    </Card>
  );
}
