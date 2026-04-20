"use client";

import { useEffect, useState } from "react";

const WORKFLOW_WEB_PORT = 3456;
const RUN_ID_PLACEHOLDER = "<run_id>";

export function InspectorBand() {
  const [runId, setRunId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
  const hasRun = runId !== null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid h-[180px] shrink-0 grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-5 rounded-3xl border border-white/10 bg-zinc-950 p-6">
      <div className="flex min-w-0 flex-col justify-between">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Inspect this run
          </p>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy inspector command"
            className="shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {hasRun ? (
          <a
            href={`http://localhost:${WORKFLOW_WEB_PORT}/run/${runId}`}
            target="_blank"
            rel="noreferrer"
            className="block min-w-0 truncate whitespace-nowrap font-mono text-[28px] leading-tight text-emerald-300 transition-colors hover:text-white"
          >
            <span className="text-zinc-600">$ </span>
            {command}
          </a>
        ) : (
          <span className="block min-w-0 truncate whitespace-nowrap font-mono text-[28px] leading-tight text-zinc-500">
            <span className="text-zinc-700">$ </span>
            {command}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-between border-l border-white/10 pl-5">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Paste to your agent
        </p>
        <p className="text-xl leading-snug text-zinc-300">
          Paste the inspector output into your agent and ask it to explain the pattern.
        </p>
      </div>
    </div>
  );
}
