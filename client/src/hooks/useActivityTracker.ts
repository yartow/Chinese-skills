import { useEffect, useRef } from "react";

const FLUSH_INTERVAL_MS = 30_000;

function localDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function flush(view: string, seconds: number): Promise<void> {
  if (seconds <= 0) return;
  const body = JSON.stringify({ date: localDateString(), view, seconds });
  // sendBeacon is fire-and-forget and survives page unload
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/activity", blob);
  } else {
    fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

/**
 * Tracks active time (tab visible) spent on a view and flushes it to the server
 * every 30 seconds and whenever the tab is hidden or the component unmounts.
 *
 * @param view  'standard' | 'test'
 */
export function useActivityTracker(view: "standard" | "test") {
  const activeStart = useRef<number | null>(null);
  const pending = useRef(0);

  function startTimer() {
    if (activeStart.current === null && document.visibilityState === "visible") {
      activeStart.current = Date.now();
    }
  }

  function pauseTimer() {
    if (activeStart.current !== null) {
      pending.current += (Date.now() - activeStart.current) / 1000;
      activeStart.current = null;
    }
  }

  function flushPending() {
    pauseTimer();
    const secs = pending.current;
    pending.current = 0;
    flush(view, secs);
  }

  useEffect(() => {
    startTimer();

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushPending();
      } else {
        startTimer();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && activeStart.current !== null) {
        const elapsed = (Date.now() - activeStart.current) / 1000;
        pending.current += elapsed;
        activeStart.current = Date.now(); // reset window
        const secs = pending.current;
        pending.current = 0;
        flush(view, secs);
      }
    }, FLUSH_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
      flushPending();
    };
  }, [view]);
}
