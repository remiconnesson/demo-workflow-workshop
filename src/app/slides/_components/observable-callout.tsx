"use client";

import { useEffect, useState } from "react";

const WORKFLOW_WEB_PORT = 3456;
const RUN_ID_PLACEHOLDER = "<run_id>";

// Ambient chip under Act I slides that surfaces the `npx workflow web run <id>`
// dashboard command. Auto-fills from the most recent run so the presenter can
// point at it after the happy-path demo. No feed, no logs — per
// .impeccable.md rule #8, just a single static command + short eyebrow.
export function ObservableCallout() {
  const [runId, setRunId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/runs/latest", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { runId: string | null };
        if (!cancelled) setRunId(data.runId);
      } catch {
        // placeholder stays
      }
    }
    load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const display = runId ?? RUN_ID_PLACEHOLDER;
  const command = `npx workflow web run ${display}`;
  const href = runId
    ? `http://localhost:${WORKFLOW_WEB_PORT}/run/${runId}`
    : undefined;

  const commonClasses =
    "block min-w-0 truncate whitespace-nowrap font-mono text-[22px] leading-tight transition-colors";

  return (
    <div className="flex h-[72px] shrink-0 items-center gap-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] px-6 py-3">
      <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 font-mono text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
        Observable
      </span>
      <div className="min-w-0 flex-1">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`${commonClasses} text-emerald-200 hover:text-white`}
          >
            <span className="text-zinc-600">$ </span>
            {command}
          </a>
        ) : (
          <span className={`${commonClasses} text-zinc-500`}>
            <span className="text-zinc-700">$ </span>
            {command}
          </span>
        )}
      </div>
      <span className="shrink-0 text-base text-zinc-400">
        Live dashboard · timeline · streams · every step visible
      </span>
    </div>
  );
}
