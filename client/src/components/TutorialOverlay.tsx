import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

interface TutorialStep {
  targetTestId: string | null;
  title: string;
  description: string;
}

const STEPS: TutorialStep[] = [
  {
    targetTestId: "nav-home",
    title: "Daily Practice",
    description:
      "Your daily study hub. Each day a fresh set of characters is queued for review. Three icons show your recognition, writing, and tone mastery at a glance. Work through them until all three turn green.",
  },
  {
    targetTestId: "nav-standard",
    title: "Standard Mode",
    description:
      "Browse characters page by page in frequency order. Tap any character to open its detail view with stroke order, pinyin, and example sentences.",
  },
  {
    targetTestId: "nav-words",
    title: "Words Mode",
    description:
      "Study vocabulary words built from the characters you already know. Great for building reading fluency beyond individual characters.",
  },
  {
    targetTestId: "nav-search",
    title: "Search",
    description:
      "Search for any character by pinyin, English meaning, or the character itself. Jump straight to its detail page from here.",
  },
  {
    targetTestId: "nav-test",
    title: "Test Mode",
    description:
      "Challenge yourself with quizzes — choose between recognition, writing, or tone tests. AI-powered feedback is available if you set an Anthropic API key in Settings.",
  },
  {
    targetTestId: "nav-browse",
    title: "Browse",
    description:
      "See all characters in a compact grid sorted by frequency. Filter by level or mastery status to focus on exactly what you need.",
  },
  {
    targetTestId: "nav-saved",
    title: "Saved",
    description:
      "Characters you have bookmarked for quick reference. Heart any character on its detail page to add it here.",
  },
  {
    targetTestId: null,
    title: "You are all set!",
    description:
      'Use the "..." settings menu (top-right of the Daily page) to adjust your reading level, daily character count, and AI features. You can replay this tutorial any time from the Settings panel.',
  },
];

const PADDING = 8;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TutorialOverlayProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function TutorialOverlay({ visible, onDismiss }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<Rect | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const currentStep = STEPS[step];

  const measureTarget = useCallback(() => {
    const testId = currentStep?.targetTestId;
    if (!testId) {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(`[data-testid="${testId}"]`);
    if (!el) {
      setSpotlightRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setSpotlightRect({
      top: r.top - PADDING,
      left: r.left - PADDING,
      width: r.width + PADDING * 2,
      height: r.height + PADDING * 2,
    });
  }, [currentStep?.targetTestId]);

  useEffect(() => {
    if (!visible) return;
    measureTarget();

    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    observerRef.current = new ResizeObserver(measureTarget);
    observerRef.current.observe(document.documentElement);

    window.addEventListener("resize", measureTarget);
    return () => {
      window.removeEventListener("resize", measureTarget);
      observerRef.current?.disconnect();
    };
  }, [visible, measureTarget]);

  const dismiss = useCallback(
    (completed = false) => {
      localStorage.setItem("tutorialSeen", "1");
      onDismiss();
      if (completed) {
        setStep(0);
      }
    },
    [onDismiss]
  );

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss(true);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSkip = () => {
    dismiss(false);
    setStep(0);
  };

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  if (!visible) return null;

  const isLast = step === STEPS.length - 1;
  const isCentered = currentStep.targetTestId === null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let cardStyle: React.CSSProperties = {};
  if (!isCentered && spotlightRect) {
    const cardWidth = 320;
    const cardEstimatedHeight = 200;
    const spaceBelow = vh - (spotlightRect.top + spotlightRect.height);
    const spaceAbove = spotlightRect.top;

    let top: number;
    if (spaceBelow >= cardEstimatedHeight + 12) {
      top = spotlightRect.top + spotlightRect.height + 12;
    } else if (spaceAbove >= cardEstimatedHeight + 12) {
      top = spotlightRect.top - cardEstimatedHeight - 12;
    } else {
      top = Math.max(12, Math.min(spotlightRect.top + spotlightRect.height + 12, vh - cardEstimatedHeight - 12));
    }

    let left = spotlightRect.left + spotlightRect.width / 2 - cardWidth / 2;
    left = Math.max(12, Math.min(left, vw - cardWidth - 12));

    cardStyle = { position: "fixed", top, left, width: cardWidth };
  } else {
    cardStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: Math.min(360, vw - 32),
    };
  }

  return (
    <div
      className="fixed inset-0 z-[9999]"
      data-testid="tutorial-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial"
    >
      {spotlightRect && !isCentered ? (
        <div
          className="fixed"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
            pointerEvents: "auto",
            borderRadius: "6px",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/65" />
      )}

      <div
        className="bg-card border rounded-md shadow-lg p-5 z-10 flex flex-col gap-3"
        style={cardStyle}
        data-testid="tutorial-card"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {step + 1} / {STEPS.length}
          </p>
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleSkip}
            data-testid="tutorial-skip"
          >
            Skip tutorial
          </button>
        </div>

        <div>
          <h3 className="font-semibold text-base leading-snug mb-1" data-testid="tutorial-step-title">
            {currentStep.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="tutorial-step-description">
            {currentStep.description}
          </p>
        </div>

        <div className="flex items-center gap-2 justify-end pt-1">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={handlePrev} data-testid="tutorial-prev">
              Prev
            </Button>
          )}
          <Button size="sm" onClick={handleNext} data-testid="tutorial-next">
            {isLast ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}