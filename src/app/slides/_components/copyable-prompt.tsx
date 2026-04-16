"use client";

import { useEffect, useState } from "react";

const RUN_ID_TOKEN = "<run_id>";

export function CopyablePrompt({ prompt, label = "Paste into your AI agent", compact }: { prompt: string; label?: string; compact?: boolean }) {
  const [runId, setRunId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hasRunIdToken = prompt.includes(RUN_ID_TOKEN);

  useEffect(() => {
    if (!hasRunIdToken) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/runs/latest", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { runId: string | null };
        if (!cancelled) setRunId(data.runId);
      } catch {
        // leave runId null — placeholder token stays in the prompt
      }
    }
    load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [hasRunIdToken]);

  const resolved = prompt.replaceAll(RUN_ID_TOKEN, runId ?? RUN_ID_TOKEN);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(resolved);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  // Collapse single newlines into spaces, keep paragraph breaks (double newlines)
  const reflowed = resolved
    .replace(/\n{2,}/g, "\n\n")           // normalize 3+ newlines to double
    .split("\n\n")                         // split on paragraph breaks
    .map((p) => p.replace(/\n/g, " "))    // collapse single newlines within paragraphs
    .join("\n\n");

  // Split the resolved prompt into the inspect command line and the rest
  const inspectMatch = reflowed.match(/^(.*)(npx workflow inspect run .+)$/m);
  const inspectLine = inspectMatch?.[2] ?? null;
  const promptWithoutInspect = inspectLine
    ? reflowed.replace(inspectLine, "").replace(/\n{3,}/g, "\n\n").trim()
    : reflowed;

  return (
    <div className={`relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 px-6 py-5 text-left ${compact ? "" : "h-[320px]"}`}>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="pt-1 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
          {label}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy prompt"
          className="shrink-0 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span className="inline-block min-w-[3rem] text-center font-mono text-xs uppercase tracking-[0.18em]">
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </div>
      {inspectLine && (
        <p className={`font-mono text-lg transition-colors duration-300 ${runId ? "text-emerald-300" : "text-zinc-500"}`}>
          {inspectLine}
        </p>
      )}
      <pre className="mt-3 flex-1 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-300">
        {promptWithoutInspect}
      </pre>
      {hasRunIdToken && !runId && (
        <p className="mt-2 text-sm text-zinc-600">
          Run a demo — the run ID fills in automatically.
        </p>
      )}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
