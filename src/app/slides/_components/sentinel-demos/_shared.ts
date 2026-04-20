import { useEffect, useState } from "react";

// Listen for the global slide:run / slide:reset CustomEvents dispatched by
// src/app/slides/layout.tsx when the presenter hits `r` or `Shift+R`.
// No slug filter — only one sentinel demo is mounted at a time per route.
export function useSlideRunReset({
  onStart,
  onReset,
}: {
  onStart: () => void;
  onReset: () => void;
}) {
  useEffect(() => {
    window.addEventListener("slide:run", onStart);
    window.addEventListener("slide:reset", onReset);
    return () => {
      window.removeEventListener("slide:run", onStart);
      window.removeEventListener("slide:reset", onReset);
    };
  }, [onStart, onReset]);
}

// Fire-and-forget POST to the observer agent on first activation so the
// AgentDebugDrawer shows a real runId. Animation is independent of the
// real run.
export function useObserverRunId(active: boolean): string | undefined {
  const [runId, setRunId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!active || runId) return;
    let cancelled = false;
    fetch("/api/agent/observer/start", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { runId?: string } | null) => {
        if (!cancelled && json?.runId) setRunId(json.runId);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [active, runId]);

  return runId;
}
