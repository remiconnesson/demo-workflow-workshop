"use client";

import { useEffect, useState } from "react";

const RUN_ID_TOKEN = "<run_id>";

export function CopyablePrompt({ prompt }: { prompt: string }) {
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
        // leave runId null — placeholder token stays in the prompt
      }
    }
    load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

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

  return (
    <div className="flex h-[320px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 px-10 py-6 text-left">
      <div className="mb-3 flex items-center justify-between gap-6">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
          Paste into your AI agent
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy prompt"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span className="inline-block min-w-[3.5rem] text-center font-mono text-xs uppercase tracking-[0.18em]">
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </div>
      <pre className="flex-1 overflow-y-auto whitespace-pre-wrap font-mono text-base leading-relaxed text-zinc-300">
        {resolved}
      </pre>
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
