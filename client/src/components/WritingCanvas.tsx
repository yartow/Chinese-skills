import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export type GridType = "field" | "cross" | "blank";

export interface WritingCanvasHandle {
  getDataUrl: () => string;
  clear: () => void;
  isEmpty: () => boolean;
}

interface Props {
  gridType: GridType;
  size?: number;
  readOnly?: boolean;
  initialData?: string; // base64 PNG to display (read-only mode)
  onChange?: () => void;
}

const STROKE_COLOR = "#1a1a2e";

function drawGrid(ctx: CanvasRenderingContext2D, size: number, gridType: GridType) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  if (gridType === "blank") return;

  const mid = size / 2;

  // Outer border
  ctx.strokeStyle = "rgba(100,140,200,0.5)";
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

  // Center cross (dashed)
  ctx.strokeStyle = "rgba(100,140,200,0.4)";
  ctx.lineWidth = 0.8;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(mid, 0); ctx.lineTo(mid, size);
  ctx.moveTo(0, mid); ctx.lineTo(size, mid);
  ctx.stroke();

  if (gridType === "cross") {
    // Diagonals
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(size, size);
    ctx.moveTo(size, 0); ctx.lineTo(0, size);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

const WritingCanvas = forwardRef<WritingCanvasHandle, Props>(function WritingCanvas(
  { gridType, size = 200, readOnly = false, initialData, onChange },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<{ x: number; y: number }[][]>([]);
  const currentStrokeRef = useRef<{ x: number; y: number }[] | null>(null);
  const isDrawingRef = useRef(false);
  const hasStrokesRef = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    drawGrid(ctx, size, gridType);
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = Math.max(3, size / 60);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
    if (currentStrokeRef.current && currentStrokeRef.current.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(currentStrokeRef.current[0].x, currentStrokeRef.current[0].y);
      for (let i = 1; i < currentStrokeRef.current.length; i++) {
        ctx.lineTo(currentStrokeRef.current[i].x, currentStrokeRef.current[i].y);
      }
      ctx.stroke();
    }
  }, [gridType, size]);

  // Draw grid on mount / gridType change
  useEffect(() => {
    if (readOnly && initialData) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      drawGrid(ctx, size, gridType);
      const img = new Image();
      img.onload = () => {
        // Composite: grid already drawn, now draw student strokes on top
        // The stored image already has the grid baked in, so just draw it directly
        ctx.drawImage(img, 0, 0, size, size);
      };
      img.src = initialData;
    } else {
      redraw();
    }
  }, [gridType, size, readOnly, initialData, redraw]);

  useImperativeHandle(ref, () => ({
    getDataUrl: () => canvasRef.current?.toDataURL("image/png") ?? "",
    clear: () => {
      strokesRef.current = [];
      currentStrokeRef.current = null;
      isDrawingRef.current = false;
      hasStrokesRef.current = false;
      redraw();
      onChange?.();
    },
    isEmpty: () => !hasStrokesRef.current,
  }));

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function onStart(e: React.MouseEvent | React.TouchEvent) {
    if (readOnly) return;
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    isDrawingRef.current = true;
    currentStrokeRef.current = [pos];
    redraw();
  }

  function onMove(e: React.MouseEvent | React.TouchEvent) {
    if (readOnly || !isDrawingRef.current || !currentStrokeRef.current) return;
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    currentStrokeRef.current.push(pos);
    redraw();
  }

  function onEnd(e: React.MouseEvent | React.TouchEvent) {
    if (readOnly || !isDrawingRef.current) return;
    e.preventDefault();
    if (currentStrokeRef.current && currentStrokeRef.current.length >= 2) {
      strokesRef.current.push(currentStrokeRef.current);
      hasStrokesRef.current = true;
      onChange?.();
    }
    currentStrokeRef.current = null;
    isDrawingRef.current = false;
    redraw();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="border border-muted rounded touch-none"
        style={{ width: size, height: size, cursor: readOnly ? "default" : "crosshair" }}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
      />
      {!readOnly && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground gap-1"
          onClick={() => {
            strokesRef.current = [];
            currentStrokeRef.current = null;
            isDrawingRef.current = false;
            hasStrokesRef.current = false;
            redraw();
            onChange?.();
          }}
        >
          <Eraser className="w-3 h-3" /> Clear
        </Button>
      )}
    </div>
  );
});

export default WritingCanvas;
