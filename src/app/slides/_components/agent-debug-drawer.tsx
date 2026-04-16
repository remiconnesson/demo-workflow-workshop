"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Shared inline debug drawer for agent demo slides.
//
// Shows the run ID (clickable link to workflow web UI) and a scrollable
// event feed. Designed to sit INSIDE the demo layout — never as a fixed
// overlay. Each agent demo embeds this in its sidebar or right column.
// ---------------------------------------------------------------------------

const WORKFLOW_WEB_PORT = 3456;

export type DebugEvent = { kind: string; msg: string };

function kindColor(kind: string): string {
  switch (kind) {
    case "OK ": return "text-emerald-400";
    case "ERR": return "text-red-400";
    case "WAI": case "HOK": return "text-amber-400";
    case "CMP": return "text-fuchsia-400";
    case "RUN": return "text-sky-400";
    case "RPL": return "text-emerald-400";
    case "SLP": return "text-amber-400";
    case "END": return "text-white";
    default: return "text-zinc-500";
  }
}

export function AgentDebugDrawer({
  runId,
  events,
}: {
  runId: string | undefined;
  events: DebugEvent[];
}) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [events.length]);

  return (
    <div className="flex min-h-[48px] flex-1 flex-col rounded-lg border border-white/10 bg-zinc-950/95 px-5 py-3">
      {runId ? (
        <a
          href={`http://localhost:${WORKFLOW_WEB_PORT}/run/${runId}`}
          target="_blank"
          rel="noreferrer"
          className="truncate font-mono text-sm text-zinc-400 transition-colors hover:text-white"
        >
          <span className="text-zinc-600">$</span> npx workflow inspect run{" "}
          {runId}
        </a>
      ) : (
        <span className="font-mono text-sm text-zinc-600">
          <span className="text-zinc-700">$</span> npx workflow inspect run{" "}
          &lt;run_id&gt;
        </span>
      )}

      {events.length > 0 && (
        <div
          ref={feedRef}
          className="mt-3 flex-1 overflow-y-auto border-t border-white/5 pt-3 font-mono text-sm"
        >
          {events.map((ev, i) => (
            <div key={i} className="flex gap-3 py-0.5">
              <span
                className={`w-8 shrink-0 font-semibold ${kindColor(ev.kind)}`}
              >
                {ev.kind}
              </span>
              <span className="truncate text-zinc-400">{ev.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
