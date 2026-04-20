"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Support · Retry
//
// Elena Ruiz filed ticket tkt-4417 on order ord-8842. The DurableAgent
// classifies → credits → emails. The Stripe credit endpoint flakes on
// attempt 1 (HTTP 429). The retry replays the same stepId, so Stripe
// dedupes — Elena is credited exactly once, and the agent never sees
// the blip.
// ---------------------------------------------------------------------------

type ToolKey =
  | "classifyComplaint"
  | "issueGoodwillCredit"
  | "sendApologyEmail";

type ToolState = {
  key: ToolKey;
  label: string;
  sub: string;
  status: "idle" | "running" | "retrying" | "done" | "failed";
  attempts: number;
  detail?: string;
};

const INITIAL_TOOLS: ToolState[] = [
  {
    key: "classifyComplaint",
    label: "Classify complaint",
    sub: "Triage the ticket",
    status: "idle",
    attempts: 0,
  },
  {
    key: "issueGoodwillCredit",
    label: "Issue goodwill credit",
    sub: "Stripe · idempotent per stepId",
    status: "idle",
    attempts: 0,
  },
  {
    key: "sendApologyEmail",
    label: "Send apology email",
    sub: "Resend · transactional",
    status: "idle",
    attempts: 0,
  },
];

type ChunkLike = {
  type?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  toolCallId?: string;
  delta?: string;
};

export default function SupportRetryPage() {
  const [tools, setTools] = useState<ToolState[]>(INITIAL_TOOLS);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [runId, setRunId] = useState<string | null>(null);
  const summaryRef = useRef("");

  const updateTool = useCallback(
    (key: ToolKey, patch: Partial<ToolState>) => {
      setTools((prev) =>
        prev.map((t) => (t.key === key ? { ...t, ...patch } : t)),
      );
    },
    [],
  );

  const run = useCallback(async () => {
    setTools(INITIAL_TOOLS);
    setSummary("");
    summaryRef.current = "";
    setRunning(true);

    try {
      const res = await fetch("/api/experiments/support-retry/start", {
        method: "POST",
      });
      setRunId(res.headers.get("x-workflow-run-id"));
      if (!res.body) throw new Error("no stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk: ChunkLike;
          try {
            chunk = JSON.parse(line) as ChunkLike;
          } catch {
            continue;
          }
          handleChunk(chunk);
        }
      }
    } catch (err) {
      console.error("[support-retry] stream error", err);
    } finally {
      setRunning(false);
    }
  }, []);

  const handleChunk = useCallback((chunk: ChunkLike) => {
    const type = chunk.type ?? "";
    const toolName = chunk.toolName as ToolKey | undefined;

    // Tool call lifecycle. UIMessageChunk types from ai-sdk are
    // "tool-input-available" (call starts), "tool-output-available"
    // (success), and "tool-output-error" (step threw — for RetryableError
    // the SDK still replays, and we'll see another input-available +
    // output-available pair for the same toolCallId/toolName).
    if (type === "tool-input-available" && toolName) {
      setTools((prev) =>
        prev.map((t) => {
          if (t.key !== toolName) return t;
          const attempts = t.attempts + 1;
          return {
            ...t,
            attempts,
            status: attempts > 1 ? "retrying" : "running",
          };
        }),
      );
      return;
    }

    if (type === "tool-output-available" && toolName) {
      const out = chunk.output as Record<string, unknown> | undefined;
      let detail = "";
      if (toolName === "classifyComplaint" && out) {
        detail = `${String(out.category ?? "")} · ${String(out.sentiment ?? "")}`;
      } else if (toolName === "issueGoodwillCredit" && out) {
        detail = `${String(out.creditId ?? "")} · $${String(out.amountUsd ?? "")} · key=${String(out.idempotencyKey ?? "").slice(-10)}`;
      } else if (toolName === "sendApologyEmail" && out) {
        detail = `${String(out.to ?? "")}`;
      }
      updateTool(toolName, { status: "done", detail });
      return;
    }

    if (type === "tool-output-error" && toolName) {
      // RetryableError surfaces here on attempt 1; the runtime will
      // replay the same step — next we'll see another input-available.
      updateTool(toolName, {
        status: "retrying",
        detail: chunk.errorText?.slice(0, 120),
      });
      return;
    }

    if (type === "text-delta" && typeof chunk.delta === "string") {
      summaryRef.current += chunk.delta;
      setSummary(summaryRef.current);
      return;
    }
  }, [updateTool]);

  return (
    <div className="h-full overflow-y-auto bg-black px-12 py-10 text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
            Customer success · Retry
          </p>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight">
            Stripe flakes. Elena gets credited once.
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-zinc-400">
            Ticket{" "}
            <span className="font-mono text-zinc-300">tkt-4417</span> from
            Elena Ruiz on order{" "}
            <span className="font-mono text-zinc-300">ord-8842</span>. The
            credit tool throws <span className="font-mono text-sky-300">RetryableError</span>{" "}
            on attempt 1. The runtime replays the same{" "}
            <span className="font-mono text-sky-300">stepId</span> — which
            we use as Stripe&rsquo;s idempotency key. One credit, zero
            duplicates, agent none the wiser.
          </p>
        </header>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "Running agent…" : "Run support agent"}
          </button>
          {runId ? (
            <span className="font-mono text-xs text-zinc-500">
              runId: {runId}
            </span>
          ) : null}
        </div>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool.key} tool={tool} />
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Agent reply
          </p>
          <p className="mt-4 min-h-[4rem] text-2xl leading-snug text-zinc-100">
            {summary || (
              <span className="text-zinc-600">
                Waiting for the agent to wrap up…
              </span>
            )}
          </p>
        </section>
      </div>
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolState }) {
  const statusStyles: Record<ToolState["status"], string> = {
    idle: "border-white/10 bg-zinc-950 text-zinc-500",
    running: "border-sky-400/40 bg-sky-500/5 text-sky-200",
    retrying: "border-sky-400/60 bg-sky-500/10 text-sky-200 animate-pulse",
    done: "border-emerald-400/40 bg-emerald-500/5 text-emerald-200",
    failed: "border-red-400/40 bg-red-500/10 text-red-200",
  };

  const statusLabel: Record<ToolState["status"], string> = {
    idle: "IDLE",
    running: "RUNNING",
    retrying: "RETRYING",
    done: "DONE",
    failed: "FAILED",
  };

  return (
    <div
      className={`flex min-h-[220px] flex-col justify-between rounded-2xl border p-6 transition-colors duration-300 ${statusStyles[tool.status]}`}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Tool
          </span>
          <span
            className={`rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] ${
              tool.status === "retrying"
                ? "border-sky-400/60 bg-sky-500/20 text-sky-200"
                : tool.status === "done"
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                  : tool.status === "running"
                    ? "border-sky-400/40 bg-sky-500/10 text-sky-200"
                    : "border-white/10 bg-white/5 text-zinc-500"
            }`}
          >
            {statusLabel[tool.status]}
          </span>
        </div>
        <h3 className="mt-4 text-2xl font-semibold text-zinc-100">
          {tool.label}
        </h3>
        <p className="mt-1 font-mono text-xs text-zinc-500">{tool.sub}</p>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Attempts
          </span>
          <span
            className={`font-mono text-2xl ${
              tool.attempts > 1 ? "text-sky-300" : "text-zinc-300"
            }`}
          >
            {tool.attempts}
          </span>
        </div>
        {tool.attempts > 1 ? (
          <span className="rounded-full border border-sky-400/60 bg-sky-500/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
            same stepId
          </span>
        ) : null}
      </div>

      <p className="mt-3 min-h-[2.5rem] font-mono text-xs leading-relaxed text-zinc-400">
        {tool.detail ?? " "}
      </p>
    </div>
  );
}
