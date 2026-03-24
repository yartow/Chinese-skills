import { Card } from "@/components/ui/card";
import StarRating from "./StarRating";
import { cn } from "@/lib/utils";

interface CharacterCardProps {
  character: string;
  index: number;
  reading: boolean;
  writing: boolean;
  radical: boolean;
  onToggleReading: () => void;
  onToggleWriting: () => void;
  onToggleRadical: () => void;
  onClick: () => void;
  className?: string;
}

export default function CharacterCard({
  character,
  index,
  reading,
  writing,
  radical,
  onToggleReading,
  onToggleWriting,
  onToggleRadical,
  onClick,
  className,
}: CharacterCardProps) {
  return (
    <Card
      className={cn(
        "p-6 flex flex-col items-center gap-4 cursor-pointer hover-elevate transition-all relative",
        className
      )}
      onClick={onClick}
      data-testid={`card-character-${character}`}
    >
      <span
        className="absolute top-2 left-3 text-xs text-muted-foreground font-mono select-none"
        data-testid={`text-index-${index}`}
      >
        #{index}
      </span>
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
