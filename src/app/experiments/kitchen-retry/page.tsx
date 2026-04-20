"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Kitchen coordinator · Retry demo
//
// One DurableAgent call running three tools. The middle tool
// (sendTicketToPrinter) throws RetryableError on attempt 1 and succeeds on
// attempt 2. This page shows the retry visibly — the tool card flashes
// sky-400 and re-fires — while the agent's prose never mentions it.
// ---------------------------------------------------------------------------

type ToolStatus = "pending" | "running" | "retrying" | "done" | "error";

type ToolCall = {
  toolCallId: string;
  toolName: string;
  status: ToolStatus;
  input?: unknown;
  output?: unknown;
  attempts: number;
  lastError?: string;
};

type WireChunk =
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  | { type: "tool-input-start"; toolCallId: string; toolName: string }
  | {
      type: "tool-input-available";
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | { type: "tool-output-available"; toolCallId: string; output: unknown }
  | { type: "tool-output-error"; toolCallId: string; errorText: string }
  | { type: string; [k: string]: unknown };

const TOOL_LABEL: Record<string, string> = {
  checkPrepCapacity: "checkPrepCapacity",
  sendTicketToPrinter: "sendTicketToPrinter",
  confirmFireTime: "confirmFireTime",
};

const TOOL_ROLE: Record<string, string> = {
  checkPrepCapacity: "Capacity probe",
  sendTicketToPrinter: "Printer dispatch (flaky)",
  confirmFireTime: "Expo confirmation",
};

function formatValue(v: unknown): string {
  if (v === undefined) return "—";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default function KitchenRetryPage() {
  const [status, setStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [finalText, setFinalText] = useState("");
  const [tools, setTools] = useState<ToolCall[]>([]);
  const [retryBanner, setRetryBanner] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const upsertTool = useCallback(
    (id: string, updater: (prev: ToolCall | undefined) => ToolCall) => {
      setTools((prev) => {
        const idx = prev.findIndex((t) => t.toolCallId === id);
        if (idx === -1) {
          return [...prev, updater(undefined)];
        }
        const next = [...prev];
        next[idx] = updater(prev[idx]);
        return next;
      });
    },
    [],
  );

  const run = useCallback(async () => {
    // Reset state
    setStatus("running");
    setFinalText("");
    setTools([]);
    setRetryBanner(null);
    setRunId(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/experiments/kitchen-retry/start", {
        method: "POST",
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      setRunId(res.headers.get("x-workflow-run-id"));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let nl = buf.indexOf("\n");
        while (nl !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) {
            try {
              const chunk = JSON.parse(line) as WireChunk;
              handleChunk(chunk);
            } catch {
              // skip malformed line
            }
          }
          nl = buf.indexOf("\n");
        }
      }
      setStatus("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("[kitchen-retry] stream error", err);
      setStatus("error");
    }

    function handleChunk(chunk: WireChunk) {
      switch (chunk.type) {
        case "text-delta": {
          const delta = (chunk as { delta?: string }).delta ?? "";
          setFinalText((prev) => prev + delta);
          break;
        }
        case "tool-input-start": {
          const c = chunk as {
            toolCallId: string;
            toolName: string;
          };
          upsertTool(c.toolCallId, (prev) => ({
            toolCallId: c.toolCallId,
            toolName: c.toolName,
            status: "running",
            attempts: prev?.attempts ?? 1,
            input: prev?.input,
            output: prev?.output,
          }));
          break;
        }
        case "tool-input-available": {
          const c = chunk as {
            toolCallId: string;
            toolName: string;
            input: unknown;
          };
          upsertTool(c.toolCallId, (prev) => ({
            toolCallId: c.toolCallId,
            toolName: c.toolName,
            status: prev?.status ?? "running",
            input: c.input,
            output: prev?.output,
            attempts: prev?.attempts ?? 1,
          }));
          break;
        }
        case "tool-output-available": {
          const c = chunk as { toolCallId: string; output: unknown };
          upsertTool(c.toolCallId, (prev) => ({
            toolCallId: c.toolCallId,
            toolName: prev?.toolName ?? "(tool)",
            status: "done",
            input: prev?.input,
            output: c.output,
            attempts: prev?.attempts ?? 1,
          }));
          break;
        }
        case "tool-output-error": {
          // This fires when a step throws. RetryableError produces an
          // error here on attempt 1, then the runtime replays the step
          // and eventually a tool-output-available arrives.
          const c = chunk as { toolCallId: string; errorText: string };
          const isRetryable = /retry|RetryableError|offline/i.test(
            c.errorText,
          );
          upsertTool(c.toolCallId, (prev) => ({
            toolCallId: c.toolCallId,
            toolName: prev?.toolName ?? "(tool)",
            status: isRetryable ? "retrying" : "error",
            input: prev?.input,
            output: prev?.output,
            attempts: (prev?.attempts ?? 1) + (isRetryable ? 1 : 0),
            lastError: c.errorText,
          }));
          if (isRetryable) {
            setRetryBanner(
              `Printer offline — Workflow SDK replayed the step (same stepId, attempt 2).`,
            );
          }
          break;
        }
        default:
          break;
      }
    }
  }, [upsertTool]);

  const running = status === "running";
  const didRetry = tools.some((t) => t.attempts > 1 || t.status === "retrying");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-10 py-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Kitchen coordinator · Retry
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Tartine Bakery · ticket tkt-8821
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-zinc-600">
            {runId ?? "run pending"}
          </span>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="rounded-xl bg-white px-5 py-2.5 text-base font-semibold text-black transition disabled:opacity-40"
          >
            {running ? "Running…" : status === "done" ? "Run again" : "Fire ticket"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 gap-8 overflow-hidden px-10 py-8">
        {/* Left: tool ladder */}
        <div className="flex w-[640px] shrink-0 flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Tool calls
          </p>
          <div className="flex flex-col gap-4">
            {[
              "checkPrepCapacity",
              "sendTicketToPrinter",
              "confirmFireTime",
            ].map((name) => {
              const call = tools.find((t) => t.toolName === name);
              return (
                <ToolCard
                  key={name}
                  name={name}
                  role={TOOL_ROLE[name] ?? name}
                  call={call}
                />
              );
            })}
          </div>

          {/* Retry banner — fixed-height slot so no CLS */}
          <div
            className={`mt-2 flex min-h-[80px] items-center gap-4 rounded-xl border px-5 transition-opacity duration-500 ${
              retryBanner
                ? "border-sky-400/40 bg-sky-500/10 opacity-100"
                : "border-white/5 bg-transparent opacity-0"
            }`}
          >
            <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-sky-400" />
            <p className="font-mono text-base leading-snug text-sky-200">
              {retryBanner ??
                "Waiting for a printer flake…"}
            </p>
          </div>
        </div>

        {/* Right: agent prose */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Agent reply
          </p>
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-zinc-950 p-8">
            <div className="flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  status === "done"
                    ? "bg-emerald-400"
                    : status === "error"
                      ? "bg-red-400"
                      : status === "running"
                        ? "animate-pulse bg-sky-400"
                        : "bg-zinc-600"
                }`}
              />
              <span className="font-mono text-sm uppercase tracking-[0.2em] text-zinc-500">
                {status === "idle"
                  ? "Idle"
                  : status === "running"
                    ? "Agent thinking"
                    : status === "done"
                      ? "Complete"
                      : "Error"}
              </span>
            </div>
            <div className="mt-6 whitespace-pre-wrap text-2xl leading-snug text-zinc-100">
              {finalText || (
                <span className="text-zinc-600">
                  Click “Fire ticket” to dispatch to the kitchen.
                </span>
              )}
            </div>

            <div className="mt-auto border-t border-white/5 pt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Durability note
              </p>
              <p className="mt-2 text-lg leading-relaxed text-zinc-400">
                {didRetry ? (
                  <>
                    The agent called{" "}
                    <span className="font-mono text-sky-300">
                      sendTicketToPrinter
                    </span>{" "}
                    once. The first attempt threw{" "}
                    <span className="font-mono text-sky-300">
                      RetryableError
                    </span>
                    ; the Workflow runtime replayed the step under the same
                    stepId. The agent never saw the failure.
                  </>
                ) : (
                  <>
                    When the expeditor printer flakes, the tool throws{" "}
                    <span className="font-mono text-zinc-300">
                      RetryableError
                    </span>{" "}
                    — the Workflow SDK replays the step under the same stepId
                    and the agent keeps going.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolCard — fixed-size slot, state via color + pill (no CLS)
// ---------------------------------------------------------------------------

function ToolCard({
  name,
  role,
  call,
}: {
  name: string;
  role: string;
  call: ToolCall | undefined;
}) {
  const status: ToolStatus = call?.status ?? "pending";

  const border =
    status === "done"
      ? "border-emerald-400/40"
      : status === "retrying"
        ? "border-sky-400/60"
        : status === "running"
          ? "border-sky-400/40"
          : status === "error"
            ? "border-red-400/40"
            : "border-white/10";

  const pill =
    status === "done"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
      : status === "retrying"
        ? "border-sky-400/60 bg-sky-500/20 text-sky-200 animate-pulse"
        : status === "running"
          ? "border-sky-400/40 bg-sky-500/10 text-sky-300"
          : status === "error"
            ? "border-red-400/40 bg-red-500/10 text-red-300"
            : "border-white/10 bg-white/5 text-zinc-500";

  const pillLabel =
    status === "done"
      ? "DONE"
      : status === "retrying"
        ? `RETRY · attempt ${call?.attempts ?? 2}`
        : status === "running"
          ? "RUNNING"
          : status === "error"
            ? "ERROR"
            : "WAITING";

  const highlight = name === "sendTicketToPrinter";

  return (
    <div
      className={`flex min-h-[168px] flex-col gap-2 overflow-hidden rounded-xl border bg-zinc-950 p-5 transition-colors duration-300 ${border} ${
        highlight && status === "retrying" ? "ring-2 ring-sky-400/50" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg text-zinc-100">
            {TOOL_LABEL[name] ?? name}
          </span>
          {highlight ? (
            <span className="rounded-md border border-sky-400/30 bg-sky-500/5 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-sky-300">
              flaky
            </span>
          ) : null}
        </div>
        <span
          className={`rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] ${pill}`}
        >
          {pillLabel}
        </span>
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
        {role}
      </p>

      <div className="mt-1 min-h-[54px] font-mono text-xs leading-relaxed text-zinc-400">
        {call?.output ? (
          <span className="text-zinc-300">{truncate(formatValue(call.output), 180)}</span>
        ) : call?.input ? (
          <span>{truncate(formatValue(call.input), 180)}</span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}
