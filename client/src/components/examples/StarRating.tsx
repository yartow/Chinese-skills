import { useState } from "react";
import StarRating from "../StarRating";

export default function StarRatingExample() {
  const [reading, setReading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [radical, setRadical] = useState(true);

  return (
    <div className="p-8 flex items-center justify-center">
      <StarRating
        reading={reading}
        writing={writing}
        radical={radical}
        onToggleReading={() => setReading(!reading)}
        onToggleWriting={() => setWriting(!writing)}
        onToggleRadical={() => setRadical(!radical)}
      />
    </div>
  );
}
