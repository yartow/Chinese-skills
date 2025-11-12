import { BookOpen, PenTool, Grid3x3 } from "lucide-react";
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
    <div className={cn("flex items-center gap-3", className)} data-testid="star-rating">
      <button
        onClick={onToggleReading}
        className="hover-elevate active-elevate-2 p-1 rounded-md transition-colors"
        data-testid="button-toggle-reading"
        title="Reading (Pronunciation)"
      >
        <BookOpen
          className={cn(
            "w-5 h-5 transition-colors",
            reading ? "text-green-600 dark:text-green-500" : "text-gray-400 dark:text-gray-500"
          )}
        />
      </button>
      <button
        onClick={onToggleWriting}
        className="hover-elevate active-elevate-2 p-1 rounded-md transition-colors"
        data-testid="button-toggle-writing"
        title="Writing"
      >
        <PenTool
          className={cn(
            "w-5 h-5 transition-colors",
            writing ? "text-green-600 dark:text-green-500" : "text-gray-400 dark:text-gray-500"
          )}
        />
      </button>
      <button
        onClick={onToggleRadical}
        className="hover-elevate active-elevate-2 p-1 rounded-md transition-colors"
        data-testid="button-toggle-radical"
        title="Radical"
      >
        <Grid3x3
          className={cn(
            "w-5 h-5 transition-colors",
            radical ? "text-green-600 dark:text-green-500" : "text-gray-400 dark:text-gray-500"
          )}
        />
      </button>
    </div>
  );
}
