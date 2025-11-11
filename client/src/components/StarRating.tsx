import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  reading: boolean;
  writing: boolean;
  radical: boolean;
  onToggleReading?: () => void;
  onToggleWriting?: () => void;
  onToggleRadical?: () => void;
  className?: string;
}

export default function StarRating({
  reading,
  writing,
  radical,
  onToggleReading,
  onToggleWriting,
  onToggleRadical,
  className,
}: StarRatingProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="star-rating">
      <button
        onClick={onToggleReading}
        className="hover-elevate active-elevate-2 p-1 rounded-md transition-colors"
        data-testid="button-toggle-reading"
        title="Reading (Pronunciation)"
      >
        <Star
          className={cn(
            "w-5 h-5 transition-all",
            reading ? "fill-primary text-primary" : "text-muted-foreground"
          )}
        />
      </button>
      <button
        onClick={onToggleWriting}
        className="hover-elevate active-elevate-2 p-1 rounded-md transition-colors"
        data-testid="button-toggle-writing"
        title="Writing"
      >
        <Star
          className={cn(
            "w-5 h-5 transition-all",
            writing ? "fill-primary text-primary" : "text-muted-foreground"
          )}
        />
      </button>
      <button
        onClick={onToggleRadical}
        className="hover-elevate active-elevate-2 p-1 rounded-md transition-colors"
        data-testid="button-toggle-radical"
        title="Radical"
      >
        <Star
          className={cn(
            "w-5 h-5 transition-all",
            radical ? "fill-primary text-primary" : "text-muted-foreground"
          )}
        />
      </button>
    </div>
  );
}
