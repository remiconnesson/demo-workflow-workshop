"use client";

import { useEffect, useState } from "react";

const WORKFLOW_WEB_PORT = 3456;
const RUN_ID_PLACEHOLDER = "<run_id>";

// Compact, fixed-height ambient chip that rides next to each demo
// headline. Surfaces the `npx workflow inspect run <id>` command for
// the currently latest run so the presenter can always gesture at a
// real link — no event feed, no logs, per .impeccable.md rule #8.
//
// This is the smaller sibling of ObservableCallout (which uses
// `npx workflow web` on the-setup). "Inspect" is the command we teach
// the audience to pipe into their own coding agents.
export function RunInspectCallout() {
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
  const command = `npx workflow inspect run ${display}`;
  const href = runId
    ? `http://localhost:${WORKFLOW_WEB_PORT}/run/${runId}`
    : undefined;

  const commandClass =
    "block min-w-0 truncate whitespace-nowrap font-mono text-[15px] leading-tight transition-colors";

  return (
    <div className="flex h-[58px] min-w-0 shrink-0 items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] px-4">
      <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
        Observable
      </span>
      <div className="min-w-0 flex-1">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`${commandClass} text-emerald-200 hover:text-white`}
          >
            <span className="text-zinc-600">$ </span>
            {command}
          </a>
        ) : (
          <span className={`${commandClass} text-zinc-500`}>
            <span className="text-zinc-700">$ </span>
            {command}
          </span>
        )}
      </div>
    </div>
  );
}
