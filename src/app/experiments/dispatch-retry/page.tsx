"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Dispatch · Retry
//
// Narrative: a DurableAgent calls `pingDriverGps`. On the first attempt the
// driver's phone is off network → RetryableError. The runtime re-invokes
// the same stepId, and attempt 2 succeeds. The agent is blissfully
// unaware; it sees one successful tool result.
//
// Visual grammar: three tool cards (list → ping → assign). The middle
// card gets a sky accent that pulses when we detect a retry event in the
// stream, then settles into a success state carrying an "attempt: 2"
// badge. A single status line fades between states — no scrolling log.
// ---------------------------------------------------------------------------

type ToolKey = "listAvailableDrivers" | "pingDriverGps" | "assignDriver";

type ToolState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "retrying"; reason: string }
  | { phase: "done"; summary: string; attempt?: number };

type AllTools = Record<ToolKey, ToolState>;

const INITIAL: AllTools = {
  listAvailableDrivers: { phase: "idle" },
  pingDriverGps: { phase: "idle" },
  assignDriver: { phase: "idle" },
};

const TOOL_LABELS: Record<ToolKey, { title: string; subtitle: string }> = {
  listAvailableDrivers: {
    title: "listAvailableDrivers",
    subtitle: "Find drivers in SOMA",
  },
  pingDriverGps: {
    title: "pingDriverGps",
    subtitle: "Confirm driver reachability",
  },
  assignDriver: {
    title: "assignDriver",
    subtitle: "Lock the driver to the order",
  },
};

// Best-effort NDJSON → UIMessageChunk parser. We peek at tool-input-start,
// tool-input-available, tool-output-available, and error chunks.
type Chunk = {
  type?: string;
  toolName?: string;
  toolCallId?: string;
  output?: unknown;
  errorText?: string;
  input?: unknown;
};

export default function DispatchRetryPage() {
  const [tools, setTools] = useState<AllTools>(INITIAL);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "running"; message: string }
    | { kind: "retry"; message: string }
    | { kind: "done"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [retryCount, setRetryCount] = useState(0);
  const activeToolByCallId = useRef<Map<string, ToolKey>>(new Map());

  const setTool = useCallback((key: ToolKey, next: ToolState) => {
    setTools((prev) => ({ ...prev, [key]: next }));
  }, []);

  const run = useCallback(async () => {
    setTools(INITIAL);
    setRetryCount(0);
    setStatus({ kind: "running", message: "Agent thinking…" });
    activeToolByCallId.current.clear();

    let res: Response;
    try {
      res = await fetch("/api/experiments/dispatch-retry/start", {
        method: "POST",
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
      return;
    }

    if (!res.ok || !res.body) {
      setStatus({ kind: "error", message: `HTTP ${res.status}` });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk: Chunk | null = null;
          try {
            chunk = JSON.parse(line) as Chunk;
          } catch {
            continue;
          }
          if (!chunk) continue;
          handleChunk(chunk);
        }
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Stream error",
      });
      return;
    }

    setStatus((s) =>
      s.kind === "error"
        ? s
        : { kind: "done", message: "Driver dispatched." },
    );

    function handleChunk(chunk: Chunk) {
      const t = chunk.type ?? "";
      const callId = chunk.toolCallId ?? "";
      const name = (chunk.toolName ?? "") as ToolKey;

      if (t === "tool-input-start" || t === "tool-input-available") {
        if (isToolKey(name)) {
          activeToolByCallId.current.set(callId, name);
          setTool(name, { phase: "running" });
          setStatus({
            kind: "running",
            message: statusFor(name, "running"),
          });
        }
        return;
      }

      if (t === "tool-output-available") {
        const key =
          (isToolKey(name) && name) ||
          activeToolByCallId.current.get(callId);
        if (!key) return;
        const output = chunk.output as Record<string, unknown> | undefined;
        const summary = summarize(key, output);
        const attempt =
          output && typeof output.attempt === "number"
            ? (output.attempt as number)
            : undefined;
        setTool(key, { phase: "done", summary, attempt });
        setStatus({ kind: "running", message: statusFor(key, "done") });
        return;
      }

      // UIMessageChunk emits a tool-error chunk when the tool throws —
      // including our RetryableError. The runtime then replays the same
      // stepId, so the next tool-input-start for pingDriverGps is the
      // retry. We key off this pair to drive the retry highlight.
      if (t === "tool-error" || t === "error") {
        const key = activeToolByCallId.current.get(callId);
        const reason = chunk.errorText ?? "Transient failure";
        if (key === "pingDriverGps") {
          setRetryCount((n) => n + 1);
          setTool(key, { phase: "retrying", reason });
          setStatus({
            kind: "retry",
            message: "GPS ping flaked — runtime retrying with same stepId",
          });
        }
      }
    }
  }, [setTool]);

  const running =
    status.kind === "running" || status.kind === "retry";

  return (
    <div className="flex h-full w-full flex-col bg-black text-white">
      <header className="flex items-baseline justify-between border-b border-white/10 px-12 py-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Dispatch · Retry
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            GPS ping flakes, runtime retries, agent never notices
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-zinc-400">
            The DurableAgent picks the closest SOMA driver and pings their
            phone. The first ping throws{" "}
            <span className="font-mono text-sky-400">RetryableError</span>.
            The runtime re-invokes the same{" "}
            <span className="font-mono text-sky-400">stepId</span>. Attempt
            2 returns a GPS fix. The agent sees one successful result.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded-xl bg-white px-6 py-3 text-lg font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {running ? "Running…" : "Dispatch order ord-9421"}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-10 px-12 py-10">
        <StatusLine status={status} retryCount={retryCount} />

        <div className="grid grid-cols-3 gap-6">
          <ToolCard toolKey="listAvailableDrivers" state={tools.listAvailableDrivers} />
          <ToolCard toolKey="pingDriverGps" state={tools.pingDriverGps} retryCount={retryCount} />
          <ToolCard toolKey="assignDriver" state={tools.assignDriver} />
        </div>

        <RetryExplainer retryCount={retryCount} pingState={tools.pingDriverGps} />
      </div>
    </div>
  );
}

function isToolKey(x: string): x is ToolKey {
  return (
    x === "listAvailableDrivers" ||
    x === "pingDriverGps" ||
    x === "assignDriver"
  );
}

function statusFor(key: ToolKey, phase: "running" | "done"): string {
  if (phase === "running") {
    if (key === "listAvailableDrivers") return "Scanning SOMA fleet…";
    if (key === "pingDriverGps") return "Pinging driver phone…";
    return "Locking driver to order…";
  }
  if (key === "listAvailableDrivers") return "Candidates shortlisted.";
  if (key === "pingDriverGps") return "GPS fix received.";
  return "Driver assigned.";
}

function summarize(key: ToolKey, output?: Record<string, unknown>): string {
  if (!output) return "ok";
  if (key === "listAvailableDrivers") {
    const list = Array.isArray(output) ? output : [];
    return `${list.length} drivers in SOMA`;
  }
  if (key === "pingDriverGps") {
    const name = (output.name as string) ?? "driver";
    const acc = output.accuracyM ?? "?";
    return `${name} · ±${acc}m`;
  }
  if (key === "assignDriver") {
    const name = (output.driverName as string) ?? "driver";
    const eta = (output.etaMin as number) ?? 0;
    return `${name} · ETA ${eta}m`;
  }
  return "ok";
}

// ---------------------------------------------------------------------------
// UI pieces
// ---------------------------------------------------------------------------

function StatusLine({
  status,
  retryCount,
}: {
  status:
    | { kind: "idle" }
    | { kind: "running"; message: string }
    | { kind: "retry"; message: string }
    | { kind: "done"; message: string }
    | { kind: "error"; message: string };
  retryCount: number;
}) {
  const color =
    status.kind === "retry"
      ? "text-sky-300"
      : status.kind === "done"
        ? "text-emerald-300"
        : status.kind === "error"
          ? "text-red-400"
          : "text-zinc-400";
  const label =
    status.kind === "idle"
      ? "Idle · press Dispatch to begin"
      : status.kind === "running"
        ? status.message
        : status.kind === "retry"
          ? status.message
          : status.kind === "done"
            ? status.message
            : `Error: ${status.message}`;
  return (
    <div className="flex h-10 items-center gap-4">
      <span
        className={`h-3 w-3 rounded-full ${
          status.kind === "retry"
            ? "bg-sky-400 animate-pulse"
            : status.kind === "done"
              ? "bg-emerald-400"
              : status.kind === "running"
                ? "bg-amber-400 animate-pulse"
                : status.kind === "error"
                  ? "bg-red-500"
                  : "bg-zinc-700"
        }`}
      />
      <span className={`font-mono text-2xl ${color}`}>{label}</span>
      {retryCount > 0 && (
        <span className="ml-auto rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-1 font-mono text-sm uppercase tracking-[0.2em] text-sky-300">
          {retryCount} retry{retryCount === 1 ? "" : "s"} absorbed
        </span>
      )}
    </div>
  );
}

function ToolCard({
  toolKey,
  state,
  retryCount = 0,
}: {
  toolKey: ToolKey;
  state: ToolState;
  retryCount?: number;
}) {
  const labels = TOOL_LABELS[toolKey];
  const isPing = toolKey === "pingDriverGps";
  const retried = isPing && retryCount > 0;

  const borderClass =
    state.phase === "retrying"
      ? "border-sky-400/60"
      : state.phase === "done"
        ? retried
          ? "border-sky-400/40"
          : "border-emerald-400/40"
        : state.phase === "running"
          ? "border-amber-400/40"
          : "border-white/10";

  const glowClass =
    state.phase === "retrying"
      ? "shadow-[0_0_60px_-10px_rgba(56,189,248,0.6)]"
      : state.phase === "done" && retried
        ? "shadow-[0_0_40px_-10px_rgba(56,189,248,0.4)]"
        : "";

  const dot =
    state.phase === "retrying"
      ? "bg-sky-400 animate-pulse"
      : state.phase === "done"
        ? retried && isPing
          ? "bg-sky-400"
          : "bg-emerald-400"
        : state.phase === "running"
          ? "bg-amber-400 animate-pulse"
          : "bg-zinc-700";

  return (
    <div
      className={`flex min-h-[260px] flex-col rounded-2xl border bg-zinc-950 p-8 transition ${borderClass} ${glowClass}`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${dot}`} />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          tool
        </span>
      </div>
      <div className="mt-3 font-mono text-2xl text-white">{labels.title}</div>
      <div className="mt-1 text-base text-zinc-500">{labels.subtitle}</div>

      <div className="mt-auto flex min-h-[80px] flex-col justify-end">
        {state.phase === "idle" && (
          <div className="font-mono text-sm text-zinc-600">queued</div>
        )}
        {state.phase === "running" && (
          <div className="font-mono text-sm text-amber-300">running…</div>
        )}
        {state.phase === "retrying" && (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-sm uppercase tracking-[0.2em] text-sky-300">
              RetryableError
            </span>
            <span className="font-mono text-sm text-zinc-400">
              {state.reason}
            </span>
          </div>
        )}
        {state.phase === "done" && (
          <div className="flex items-center justify-between gap-4">
            <span
              className={`font-mono text-base ${
                retried && isPing ? "text-sky-200" : "text-emerald-200"
              }`}
            >
              {state.summary}
            </span>
            {state.attempt && state.attempt > 1 && (
              <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-sky-300">
                attempt {state.attempt}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RetryExplainer({
  retryCount,
  pingState,
}: {
  retryCount: number;
  pingState: ToolState;
}) {
  const revealed = retryCount > 0;
  const attempt =
    pingState.phase === "done" ? pingState.attempt ?? null : null;

  return (
    <div
      className={`flex min-h-[140px] items-center gap-10 rounded-2xl border bg-zinc-950 p-8 transition-opacity duration-500 ${
        revealed
          ? "border-sky-400/30 opacity-100"
          : "border-white/10 opacity-40"
      }`}
    >
      <div className="flex flex-col">
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          What just happened
        </span>
        <span className="mt-2 font-mono text-xl text-sky-300">
          pingDriverGps threw RetryableError on attempt 1
        </span>
        <span className="mt-1 font-mono text-xl text-emerald-300">
          {attempt
            ? `same stepId, attempt ${attempt} returned a GPS fix`
            : "runtime will replay the same stepId"}
        </span>
      </div>
      <div className="ml-auto flex flex-col items-end gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          agent saw
        </span>
        <span className="font-mono text-2xl text-white">
          one successful tool call
        </span>
      </div>
    </div>
  );
}
