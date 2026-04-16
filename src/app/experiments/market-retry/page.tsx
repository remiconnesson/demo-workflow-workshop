"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Market · Retry
//
// Narrative: a DurableAgent calls `pushSurgeToPricingService` to bump SOMA's
// surge multiplier. The first push hits a rate-limited gateway and throws
// RetryableError (HTTP 429). The runtime re-invokes the same stepId after a
// short backoff, attempt 2 goes through, and the surge lands. The agent
// sees a single successful result.
//
// Visual grammar: three tool cards (read → compute → push). The push card
// gets a sky accent that pulses on the retry, then settles into a success
// state with an "attempt: 2" badge. A single status line fades between
// states — no scrolling log.
// ---------------------------------------------------------------------------

type ToolKey =
  | "readZoneTelemetry"
  | "computeSurgeMultiplier"
  | "pushSurgeToPricingService";

type ToolState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "retrying"; reason: string }
  | { phase: "done"; summary: string; attempt?: number };

type AllTools = Record<ToolKey, ToolState>;

const INITIAL: AllTools = {
  readZoneTelemetry: { phase: "idle" },
  computeSurgeMultiplier: { phase: "idle" },
  pushSurgeToPricingService: { phase: "idle" },
};

const TOOL_LABELS: Record<ToolKey, { title: string; subtitle: string }> = {
  readZoneTelemetry: {
    title: "readZoneTelemetry",
    subtitle: "Live SOMA demand & supply",
  },
  computeSurgeMultiplier: {
    title: "computeSurgeMultiplier",
    subtitle: "Bucket demand ratio → surge",
  },
  pushSurgeToPricingService: {
    title: "pushSurgeToPricingService",
    subtitle: "Apply multiplier via rate-limited gateway",
  },
};

type Chunk = {
  type?: string;
  toolName?: string;
  toolCallId?: string;
  output?: unknown;
  errorText?: string;
  input?: unknown;
};

export default function MarketRetryPage() {
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
      res = await fetch("/api/experiments/market-retry/start", {
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
        : { kind: "done", message: "Surge applied to SOMA." },
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

      if (t === "tool-error" || t === "error") {
        const key = activeToolByCallId.current.get(callId);
        const reason = chunk.errorText ?? "Gateway rate-limited";
        if (key === "pushSurgeToPricingService") {
          setRetryCount((n) => n + 1);
          setTool(key, { phase: "retrying", reason });
          setStatus({
            kind: "retry",
            message:
              "Pricing service returned 429 — runtime retrying with same stepId",
          });
        }
      }
    }
  }, [setTool]);

  const running = status.kind === "running" || status.kind === "retry";

  return (
    <div className="flex h-full w-full flex-col bg-black text-white">
      <header className="flex items-baseline justify-between border-b border-white/10 px-12 py-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Market · Retry
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Surge push flakes, runtime retries, agent never notices
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-zinc-400">
            The DurableAgent reads live SOMA telemetry, buckets the
            demand/supply ratio into a surge multiplier, and pushes it to the
            pricing service. The first push throws{" "}
            <span className="font-mono text-sky-400">RetryableError</span>{" "}
            (HTTP 429). The runtime replays the same{" "}
            <span className="font-mono text-sky-400">stepId</span>. Attempt 2
            applies the surge. The agent sees one successful result.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded-xl bg-white px-6 py-3 text-lg font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {running ? "Running…" : "Optimize SOMA (Fri 7pm)"}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-10 px-12 py-10">
        <StatusLine status={status} retryCount={retryCount} />

        <div className="grid grid-cols-3 gap-6">
          <ToolCard
            toolKey="readZoneTelemetry"
            state={tools.readZoneTelemetry}
          />
          <ToolCard
            toolKey="computeSurgeMultiplier"
            state={tools.computeSurgeMultiplier}
          />
          <ToolCard
            toolKey="pushSurgeToPricingService"
            state={tools.pushSurgeToPricingService}
            retryCount={retryCount}
          />
        </div>

        <RetryExplainer
          retryCount={retryCount}
          pushState={tools.pushSurgeToPricingService}
        />
      </div>
    </div>
  );
}

function isToolKey(x: string): x is ToolKey {
  return (
    x === "readZoneTelemetry" ||
    x === "computeSurgeMultiplier" ||
    x === "pushSurgeToPricingService"
  );
}

function statusFor(key: ToolKey, phase: "running" | "done"): string {
  if (phase === "running") {
    if (key === "readZoneTelemetry") return "Reading SOMA telemetry…";
    if (key === "computeSurgeMultiplier") return "Bucketing demand ratio…";
    return "Pushing surge to pricing service…";
  }
  if (key === "readZoneTelemetry") return "Telemetry received.";
  if (key === "computeSurgeMultiplier") return "Multiplier computed.";
  return "Surge applied.";
}

function summarize(key: ToolKey, output?: Record<string, unknown>): string {
  if (!output) return "ok";
  if (key === "readZoneTelemetry") {
    const orders = output.activeOrders ?? "?";
    const drivers = output.availableDrivers ?? "?";
    const ratio = output.demandRatio ?? "?";
    return `${orders} orders · ${drivers} drivers · ratio ${ratio}`;
  }
  if (key === "computeSurgeMultiplier") {
    const m = output.multiplier ?? "?";
    return `${m}x recommended`;
  }
  if (key === "pushSurgeToPricingService") {
    const m = output.multiplier ?? "?";
    const name = (output.zoneName as string) ?? "zone";
    const ticket = (output.pricingTicket as string) ?? "";
    return `${name} @ ${m}x · ${ticket}`;
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
      ? "Idle · press Optimize to begin"
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
  const isPush = toolKey === "pushSurgeToPricingService";
  const retried = isPush && retryCount > 0;

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
        ? retried && isPush
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
              RetryableError · 429
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
                retried && isPush ? "text-sky-200" : "text-emerald-200"
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
  pushState,
}: {
  retryCount: number;
  pushState: ToolState;
}) {
  const revealed = retryCount > 0;
  const attempt =
    pushState.phase === "done" ? (pushState.attempt ?? null) : null;

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
          pushSurgeToPricingService threw RetryableError (429) on attempt 1
        </span>
        <span className="mt-1 font-mono text-xl text-emerald-300">
          {attempt
            ? `same stepId, attempt ${attempt} applied the 1.8x surge`
            : "runtime will replay the same stepId after backoff"}
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
