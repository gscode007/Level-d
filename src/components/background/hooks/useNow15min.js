import { useEffect, useState } from "react";

/**
 * Returns a Date that re-emits every 15 minutes (configurable). Used by the
 * time-of-day tint so the background's hue drifts with the day. One interval
 * regardless of how many components observe it (callers share state).
 */
export function useNow15min(intervalMs = 15 * 60 * 1000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    // A phone that's been backgrounded for hours should pick up the right
    // tint immediately on resume.
    const onVisible = () => { if (!document.hidden) setNow(new Date()); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  return now;
}
