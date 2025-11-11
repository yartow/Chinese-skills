import { Card } from "@/components/ui/card";
import StarRating from "./StarRating";
import { cn } from "@/lib/utils";

interface CharacterCardProps {
  character: string;
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
        "p-6 flex flex-col items-center gap-4 cursor-pointer hover-elevate transition-all",
        className
      )}
      onClick={onClick}
      data-testid={`card-character-${character}`}
    >
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
