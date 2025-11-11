import { useEffect, useRef } from "react";

interface StrokeOrderProps {
  character: string;
  className?: string;
}

export default function StrokeOrder({ character, className }: StrokeOrderProps) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (targetRef.current && typeof window !== "undefined") {
      import("hanzi-writer").then((HanziWriter) => {
        if (!targetRef.current) return;
        
        targetRef.current.innerHTML = "";
        
        const writer = HanziWriter.default.create(targetRef.current, character, {
          width: 300,
          height: 300,
          padding: 5,
          showOutline: true,
          strokeAnimationSpeed: 2,
          delayBetweenStrokes: 200,
        });

        writer.loopCharacterAnimation();
      });
    }
  }, [character]);

  return (
    <div className={className}>
      <div ref={targetRef} className="flex items-center justify-center" data-testid="stroke-order-animation" />
    </div>
  );
}
