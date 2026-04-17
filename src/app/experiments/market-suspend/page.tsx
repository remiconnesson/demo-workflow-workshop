"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Market · Suspend  (Chapter 2 of the market-retry story)
//
// Narrative: 30 minutes after chapter 1's 1.8x surge, SOMA's demand ratio has
// climbed to 14.0. The surge ladder recommends 2.5x — above the 2.0x
// autonomous policy ceiling. The DurableAgent calls `requestPricingApproval`
// which creates a hook and awaits. The workflow SUSPENDS.
//
// The page shows the zone card flip amber, a phone-style approval card
// render with the proposed multiplier + ceiling, and a single calm status
// line. Approve → workflow resumes, push goes through, card flips emerald.
// Reject → agent stands down, card stays amber with a "held" badge.
// ---------------------------------------------------------------------------

type ToolKey =
  | "readZoneTelemetry"
  | "computeSurgeMultiplier"
  | "requestPricingApproval"
  | "pushSurgeToPricingService";

type ToolState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "waiting"; token: string; proposed: number; ceiling: number }
  | { phase: "done"; summary: string; approved?: boolean };

type AllTools = Record<ToolKey, ToolState>;

const INITIAL: AllTools = {
  readZoneTelemetry: { phase: "idle" },
  computeSurgeMultiplier: { phase: "idle" },
  requestPricingApproval: { phase: "idle" },
  pushSurgeToPricingService: { phase: "idle" },
};

const TOOL_LABELS: Record<ToolKey, { title: string; subtitle: string }> = {
  readZoneTelemetry: {
    title: "readZoneTelemetry",
    subtitle: "SOMA demand & supply (30m later)",
  },
  computeSurgeMultiplier: {
    title: "computeSurgeMultiplier",
    subtitle: "Bucket ratio → multiplier + ceiling check",
  },
  requestPricingApproval: {
    title: "requestPricingApproval",
    subtitle: "Suspend until pricing PM signs off",
  },
  pushSurgeToPricingService: {
    title: "pushSurgeToPricingService",
    subtitle: "Apply approved multiplier",
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

type Suspend = {
  token: string;
  proposed: number;
  ceiling: number;
  demandRatio: number;
};

export default function MarketSuspendPage() {
  const [tools, setTools] = useState<AllTools>(INITIAL);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "running"; message: string }
    | { kind: "suspended"; message: string }
    | { kind: "resuming"; message: string }
    | { kind: "done"; message: string }
    | { kind: "stoodDown"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [suspend, setSuspend] = useState<Suspend | null>(null);
  const [decided, setDecided] = useState<
    null | { approved: boolean; reason?: string }
  >(null);
  const activeToolByCallId = useRef<Map<string, ToolKey>>(new Map());

  const setTool = useCallback((key: ToolKey, next: ToolState) => {
    setTools((prev) => ({ ...prev, [key]: next }));
  }, []);

  const run = useCallback(async () => {
    setTools(INITIAL);
    setSuspend(null);
    setDecided(null);
    setStatus({ kind: "running", message: "Agent thinking…" });
    activeToolByCallId.current.clear();

    let res: Response;
    try {
      res = await fetch("/api/experiments/market-suspend/start", {
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

    // Stream ended. Final status depends on whether push happened.
    setStatus((s) => {
      if (s.kind === "error") return s;
      if (s.kind === "stoodDown") return s;
      return { kind: "done", message: "Surge applied to SOMA at approved multiplier." };
    });

    function handleChunk(chunk: Chunk) {
      const t = chunk.type ?? "";
      const callId = chunk.toolCallId ?? "";
      const name = (chunk.toolName ?? "") as ToolKey;

      if (t === "tool-input-start" || t === "tool-input-available") {
        if (isToolKey(name)) {
          activeToolByCallId.current.set(callId, name);
          setTool(name, { phase: "running" });
          if (name === "requestPricingApproval") {
            setStatus({
              kind: "suspended",
              message: "Workflow suspended — awaiting pricing PM approval",
            });
          } else {
            setStatus({
              kind: "running",
              message: statusFor(name, "running"),
            });
          }
        }
        return;
      }

      if (t === "tool-output-available") {
        const key =
          (isToolKey(name) && name) ||
          activeToolByCallId.current.get(callId);
        if (!key) return;
        const output = chunk.output as Record<string, unknown> | undefined;

        if (key === "requestPricingApproval") {
          const approved = output?.approved === true;
          const reason =
            typeof output?.reason === "string" ? output.reason : undefined;
          const proposed =
            typeof output?.proposedMultiplier === "number"
              ? output.proposedMultiplier
              : 2.5;
          setTool(key, {
            phase: "done",
            summary: approved
              ? `approved @ ${proposed}x`
              : `rejected — held at 1.8x`,
            approved,
          });
          setDecided({ approved, reason });
          if (approved) {
            setStatus({
              kind: "resuming",
              message: "Approval received — workflow resuming",
            });
          } else {
            setStatus({
              kind: "stoodDown",
              message: "Rejected — agent stands down, surge held at 1.8x",
            });
          }
          return;
        }

        const summary = summarize(key, output);
        setTool(key, { phase: "done", summary });
        setStatus({ kind: "running", message: statusFor(key, "done") });

        // When computeSurgeMultiplier returns an above-ceiling result, we
        // know the suspend is imminent — stage the approval card.
        if (
          key === "computeSurgeMultiplier" &&
          output &&
          output.exceedsCeiling === true
        ) {
          const proposed = Number(output.multiplier ?? 2.5);
          const ceiling = Number(output.ceiling ?? 2.0);
          const demandRatio = Number(output.demandRatio ?? 14);
          setSuspend({
            token: "market-suspend:zn-soma",
            proposed,
            ceiling,
            demandRatio,
          });
          setTool("requestPricingApproval", {
            phase: "waiting",
            token: "market-suspend:zn-soma",
            proposed,
            ceiling,
          });
        }
        return;
      }
    }
  }, [setTool]);

  const decide = useCallback(
    async (approved: boolean) => {
      if (!suspend) return;
      setStatus({
        kind: "resuming",
        message: approved
          ? "Sending approval → resuming workflow"
          : "Sending rejection → agent will stand down",
      });
      try {
        await fetch("/api/experiments/market-suspend/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: suspend.token,
            approved,
            reason: approved
              ? "Approved: traffic spike justifies above-ceiling surge"
              : "Rejected: keep 1.8x, dispatch more drivers instead",
          }),
        });
      } catch (err) {
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "Approve failed",
        });
      }
    },
    [suspend],
  );

  const running =
    status.kind === "running" ||
    status.kind === "suspended" ||
    status.kind === "resuming";

  return (
    <div className="flex h-full w-full flex-col bg-black text-white">
      <header className="flex items-baseline justify-between border-b border-white/10 px-12 py-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Market · Suspend  ·  Chapter 2
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Agent wants 2.5x — policy says pause for the pricing PM
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-zinc-400">
            SOMA is still backed up 30 minutes after the 1.8x surge. The
            surge ladder recommends{" "}
            <span className="font-mono text-amber-300">2.5x</span> — above the{" "}
            <span className="font-mono text-amber-300">2.0x</span> autonomous
            ceiling. The DurableAgent calls{" "}
            <span className="font-mono text-amber-300">
              requestPricingApproval
            </span>
            . The workflow suspends on a hook. When the PM approves, the
            runtime resumes the same agent — message history intact — and the
            push lands.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded-xl bg-white px-6 py-3 text-lg font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {running ? "Running…" : "Re-optimize SOMA (Fri 7:30pm)"}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-10 px-12 py-10">
        <StatusLine status={status} />

        <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-6">
          <ToolCard toolKey="readZoneTelemetry" state={tools.readZoneTelemetry} />
          <ToolCard
            toolKey="computeSurgeMultiplier"
            state={tools.computeSurgeMultiplier}
          />
          <ToolCard
            toolKey="requestPricingApproval"
            state={tools.requestPricingApproval}
          />
          <ToolCard
            toolKey="pushSurgeToPricingService"
            state={tools.pushSurgeToPricingService}
          />
        </div>

        <ApprovalPanel
          suspend={suspend}
          decided={decided}
          status={status}
          onDecide={decide}
        />
      </div>
    </div>
  );
}

function isToolKey(x: string): x is ToolKey {
  return (
    x === "readZoneTelemetry" ||
    x === "computeSurgeMultiplier" ||
    x === "requestPricingApproval" ||
    x === "pushSurgeToPricingService"
  );
}

function statusFor(key: ToolKey, phase: "running" | "done"): string {
  if (phase === "running") {
    if (key === "readZoneTelemetry") return "Re-reading SOMA telemetry…";
    if (key === "computeSurgeMultiplier") return "Recomputing surge multiplier…";
    if (key === "requestPricingApproval")
      return "Awaiting pricing PM approval…";
    return "Pushing approved surge to pricing service…";
  }
  if (key === "readZoneTelemetry") return "Telemetry received — ratio climbing.";
  if (key === "computeSurgeMultiplier")
    return "Multiplier computed — exceeds ceiling.";
  if (key === "requestPricingApproval") return "Approval decision received.";
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
    const c = output.ceiling ?? "?";
    return `${m}x recommended · ceiling ${c}x`;
  }
  if (key === "pushSurgeToPricingService") {
    const m = output.multiplier ?? "?";
    const ticket = (output.pricingTicket as string) ?? "";
    return `SOMA @ ${m}x · ${ticket}`;
  }
  return "ok";
}

// ---------------------------------------------------------------------------
// UI pieces
// ---------------------------------------------------------------------------

function StatusLine({
  status,
}: {
  status:
    | { kind: "idle" }
    | { kind: "running"; message: string }
    | { kind: "suspended"; message: string }
    | { kind: "resuming"; message: string }
    | { kind: "done"; message: string }
    | { kind: "stoodDown"; message: string }
    | { kind: "error"; message: string };
}) {
  const color =
    status.kind === "suspended"
      ? "text-amber-300"
      : status.kind === "resuming"
        ? "text-sky-300"
        : status.kind === "done"
          ? "text-emerald-300"
          : status.kind === "stoodDown"
            ? "text-amber-300"
            : status.kind === "error"
              ? "text-red-400"
              : "text-zinc-400";

  const dot =
    status.kind === "suspended"
      ? "bg-amber-400 animate-pulse"
      : status.kind === "resuming"
        ? "bg-sky-400 animate-pulse"
        : status.kind === "done"
          ? "bg-emerald-400"
          : status.kind === "stoodDown"
            ? "bg-amber-400"
            : status.kind === "running"
              ? "bg-amber-400 animate-pulse"
              : status.kind === "error"
                ? "bg-red-500"
                : "bg-zinc-700";

  const label =
    status.kind === "idle"
      ? "Idle · press Re-optimize to begin"
      : status.kind === "error"
        ? `Error: ${status.message}`
        : status.message;

  return (
    <div className="flex h-10 items-center gap-4">
      <span className={`h-3 w-3 rounded-full ${dot}`} />
      <span className={`font-mono text-2xl ${color}`}>{label}</span>
      {status.kind === "suspended" && (
        <span className="ml-auto rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-1 font-mono text-sm uppercase tracking-[0.2em] text-amber-300">
          WAITING · durable hook
        </span>
      )}
    </div>
  );
}

function ToolCard({
  toolKey,
  state,
}: {
  toolKey: ToolKey;
  state: ToolState;
}) {
  const labels = TOOL_LABELS[toolKey];

  const borderClass =
    state.phase === "waiting"
      ? "border-amber-400/60"
      : state.phase === "done"
        ? state.approved === false
          ? "border-amber-400/40"
          : "border-emerald-400/40"
        : state.phase === "running"
          ? "border-sky-400/40"
          : "border-white/10";

  const glowClass =
    state.phase === "waiting"
      ? "shadow-[0_0_60px_-10px_rgba(251,191,36,0.6)]"
      : "";

  const dot =
    state.phase === "waiting"
      ? "bg-amber-400 animate-pulse"
      : state.phase === "done"
        ? state.approved === false
          ? "bg-amber-400"
          : "bg-emerald-400"
        : state.phase === "running"
          ? "bg-sky-400 animate-pulse"
          : "bg-zinc-700";

  return (
    <div
      className={`flex min-h-[240px] flex-col rounded-2xl border bg-zinc-950 p-7 transition ${borderClass} ${glowClass}`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${dot}`} />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          tool
        </span>
      </div>
      <div className="mt-3 font-mono text-xl text-white">{labels.title}</div>
      <div className="mt-1 text-sm text-zinc-500">{labels.subtitle}</div>

      <div className="mt-auto flex min-h-[80px] flex-col justify-end">
        {state.phase === "idle" && (
          <div className="font-mono text-sm text-zinc-600">queued</div>
        )}
        {state.phase === "running" && (
          <div className="font-mono text-sm text-sky-300">running…</div>
        )}
        {state.phase === "waiting" && (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-sm uppercase tracking-[0.2em] text-amber-300">
              SUSPENDED · waiting for human
            </span>
            <span className="font-mono text-sm text-zinc-400">
              {state.proposed}x &gt; {state.ceiling}x ceiling
            </span>
          </div>
        )}
        {state.phase === "done" && (
          <div
            className={`font-mono text-base ${
              state.approved === false ? "text-amber-200" : "text-emerald-200"
            }`}
          >
            {state.summary}
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovalPanel({
  suspend,
  decided,
  status,
  onDecide,
}: {
  suspend: Suspend | null;
  decided: null | { approved: boolean; reason?: string };
  status: { kind: string };
  onDecide: (approved: boolean) => void;
}) {
  const revealed = !!suspend;
  const awaiting = status.kind === "suspended" && !decided;

  return (
    <div
      className={`flex min-h-[200px] items-stretch gap-10 rounded-2xl border bg-zinc-950 p-8 transition-opacity duration-500 ${
        revealed
          ? awaiting
            ? "border-amber-400/40 opacity-100"
            : decided?.approved
              ? "border-emerald-400/30 opacity-100"
              : decided && !decided.approved
                ? "border-amber-400/30 opacity-100"
                : "border-white/10 opacity-100"
          : "border-white/10 opacity-40"
      }`}
    >
      <div className="flex flex-col justify-center">
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Pricing PM · Approval Request
        </span>
        <span className="mt-2 font-mono text-3xl text-white">
          SOMA zn-soma
        </span>
        <span className="mt-1 font-mono text-lg text-zinc-400">
          ratio {suspend?.demandRatio ?? "—"} · proposed{" "}
          <span className="text-amber-300">
            {suspend?.proposed ?? "—"}x
          </span>{" "}
          · ceiling {suspend?.ceiling ?? "—"}x
        </span>
      </div>

      <div className="ml-auto flex flex-col items-end justify-center gap-3">
        {awaiting ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onDecide(false)}
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-6 py-3 font-semibold text-red-300 transition hover:bg-red-500/20"
            >
              Reject — hold at 1.8x
            </button>
            <button
              type="button"
              onClick={() => onDecide(true)}
              className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-zinc-200"
            >
              Approve 2.5x surge
            </button>
          </div>
        ) : decided ? (
          <div className="flex flex-col items-end gap-2">
            <span
              className={`rounded-full border px-4 py-1 font-mono text-sm uppercase tracking-[0.2em] ${
                decided.approved
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-400/40 bg-amber-500/10 text-amber-300"
              }`}
            >
              {decided.approved ? "APPROVED" : "REJECTED"}
            </span>
            {decided.reason && (
              <span className="max-w-xs text-right text-sm text-zinc-400">
                {decided.reason}
              </span>
            )}
          </div>
        ) : (
          <span className="font-mono text-sm text-zinc-600">
            waiting for agent to suspend…
          </span>
        )}
      </div>
    </div>
  );
}
