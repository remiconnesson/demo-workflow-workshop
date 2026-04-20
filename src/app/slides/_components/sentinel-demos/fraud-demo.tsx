"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AgentDebugDrawer, type DebugEvent } from "../agent-debug-drawer";
import type { SentinelVariant } from "../../_data/sentinel-variants";
import { useSlideRunReset } from "./_shared";
import {
  AgentCallout,
  type Callout,
  type CalloutState,
} from "./_agent-callout";
import type { FraudEvent } from "@/workflows/fraud-sentinel-agent";

// ---------------------------------------------------------------------------
// Fraud sentinel: real DurableAgent-driven charge ledger.
//
// Press r → POST /api/agent/fraud-sentinel → stream data-fraud events.
// Each charge-scored event reveals a row with the LLM's risk assessment.
// batch-summary events become inline callouts. freeze events flag rows.
// Kill aborts the stream, auto-reconnects via GET /[runId]/stream.
// ---------------------------------------------------------------------------

type ChargeRowState =
  | "hidden"
  | "scoring"
  | "cleared"
  | "frozen"
  | "cached-cleared"
  | "cached-frozen";

type Charge = {
  time: string;
  card: string;
  merchant: string;
  amount: string;
  country: string;
};

const CHARGES: Charge[] = [
  { time: "14:32:01", card: "•••• 4242", merchant: "Apple Services",     amount: "$12.99",    country: "US" },
  { time: "14:32:02", card: "•••• 1117", merchant: "Uber Trip",           amount: "$24.40",    country: "US" },
  { time: "14:32:03", card: "•••• 9003", merchant: "Target",              amount: "$87.20",    country: "US" },
  { time: "14:32:04", card: "•••• 5541", merchant: "Starbucks #4812",     amount: "$6.80",     country: "US" },
  { time: "14:32:05", card: "•••• 2200", merchant: "Shell Oil",           amount: "$48.10",    country: "US" },
  { time: "14:32:07", card: "•••• 3384", merchant: "DoorDash",            amount: "$31.42",    country: "US" },
  { time: "14:32:08", card: "•••• 7719", merchant: "Netflix",             amount: "$17.99",    country: "US" },
  { time: "14:32:10", card: "•••• 6106", merchant: "Amazon Prime",        amount: "$139.00",   country: "US" },
  { time: "14:32:11", card: "•••• 0458", merchant: "Home Depot",          amount: "$412.88",   country: "US" },
  { time: "14:32:12", card: "•••• 4242", merchant: "Apple Services",      amount: "$0.99",     country: "US" },
  { time: "14:32:13", card: "•••• 8891", merchant: "Cryptonome-XYZ",      amount: "$2,400.00", country: "RU" },
];

type RowScore = {
  risk: number;
  cleared: boolean;
  reason: string;
};

type CrashPhase = "crashed" | "replaying" | "resumed";

// --- stream chunk type (matches AI SDK protocol line format) ---
type ChunkLike = {
  type?: string;
  data?: FraudEvent;
  toolName?: string;
  toolCallId?: string;
  [key: string]: unknown;
};

// --- component ----------------------------------------------------------

export function FraudDemo({ variant }: { variant: SentinelVariant }) {
  const [phase, setPhase] = useState<"idle" | "live" | "done">("idle");
  const [crashPhase, setCrashPhase] = useState<CrashPhase | null>(null);
  const [crashCount, setCrashCount] = useState(0);
  const [runId, setRunId] = useState<string | undefined>();
  const [scores, setScores] = useState<Map<number, RowScore>>(new Map());
  const [frozenCards, setFrozenCards] = useState<Set<string>>(new Set());
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [loopCount, setLoopCount] = useState(0);
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isLive = phase === "live" && !crashPhase;
  const isCrashed = crashPhase === "crashed";
  const isReplaying = crashPhase === "replaying";
  const isResumed = crashPhase === "resumed";

  // --- stream consumer ---
  const startStream = useCallback(async (reconnectRunId?: string) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      let res: Response;
      if (reconnectRunId) {
        res = await fetch(
          `/api/agent/fraud-sentinel/${encodeURIComponent(reconnectRunId)}/stream`,
          { signal: ctrl.signal },
        );
      } else {
        res = await fetch("/api/agent/fraud-sentinel", {
          method: "POST",
          signal: ctrl.signal,
        });
        const newRunId = res.headers.get("x-workflow-run-id");
        if (newRunId) setRunId(newRunId);
      }

      if (!res.body) return;
      setPhase("live");

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
      setPhase("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("[fraud-sentinel] stream error", err);
    }
  }, []);

  const handleChunk = useCallback((chunk: ChunkLike) => {
    const type = chunk.type ?? "";

    // --- data-fraud events (emitted by step tools via getWritable) ---
    if (type === "data-fraud" && chunk.data) {
      const event = chunk.data;
      if (event.type === "charge-scored") {
        applyChargeScored(event);
      }
      if (event.type === "freeze") {
        applyFreeze(event);
      }
      if (event.type === "batch-summary") {
        applyBatchSummary(event);
      }
      return;
    }

    // --- tool-input-available: the agent's decision is in the input ---
    // These arrive as the LLM streams, BEFORE the step executes,
    // so we render rows immediately instead of waiting for data-fraud.
    if (type === "tool-input-available") {
      const toolName = chunk.toolName as string | undefined;
      const input = chunk.input as Record<string, unknown> | undefined;
      if (!toolName || !input) return;

      if (toolName === "reportCharge") {
        applyChargeScored({
          index: input.index as number,
          card: input.card as string,
          risk: input.risk as number,
          cleared: input.cleared as boolean,
          reason: input.reason as string,
        });
      }
      if (toolName === "freezeAccount") {
        applyFreeze({
          card: input.card as string,
          reason: input.reason as string,
        });
      }
      if (toolName === "batchSummary") {
        applyBatchSummary({
          message: input.message as string,
          citations: input.citations as string[],
        });
      }
      return;
    }
  }, []);

  const applyChargeScored = useCallback(
    (event: { index: number; card: string; risk: number; cleared: boolean; reason: string }) => {
      setScores((prev) => {
        if (prev.has(event.index)) return prev;
        const next = new Map(prev);
        next.set(event.index, { risk: event.risk, cleared: event.cleared, reason: event.reason });
        return next;
      });
      setDebugEvents((prev) => [
        ...prev,
        {
          kind: event.cleared ? "OK " : "ERR",
          msg: `reportCharge(${event.card} · risk ${event.risk.toFixed(2)})`,
        },
      ]);
    },
    [],
  );

  const applyFreeze = useCallback(
    (event: { card: string; reason: string }) => {
      setFrozenCards((prev) => {
        if (prev.has(event.card)) return prev;
        return new Set(prev).add(event.card);
      });
      setDebugEvents((prev) => [
        ...prev,
        { kind: "ERR", msg: `freezeAccount(${event.card})` },
      ]);
    },
    [],
  );

  const applyBatchSummary = useCallback(
    (event: { message: string; citations: string[] }) => {
      setCallouts((prev) => [
        ...prev,
        {
          id: `callout-${prev.length}`,
          avatar: "F",
          agentName: "Fraud sentinel",
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          tone: event.message.toLowerCase().includes("froze") || event.message.toLowerCase().includes("frozen")
            ? "red"
            : "emerald",
          message: event.message,
          citations: event.citations,
          verdict: event.message.toLowerCase().includes("froze") || event.message.toLowerCase().includes("frozen")
            ? `froze ${event.citations[0] ?? ""}`
            : `cleared ${event.citations.length}`,
        },
      ]);
      setLoopCount((n) => n + 1);
      setDebugEvents((prev) => [
        ...prev,
        { kind: "CMP", msg: `batchSummary(${event.message.slice(0, 50)}…)` },
      ]);
    },
    [],
  );

  // --- auto-scroll ---
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [scores.size, callouts.length]);

  // --- crash auto-recovery ---
  useEffect(() => {
    if (!crashPhase) return;
    const delays: Record<CrashPhase, number> = {
      crashed: 2200,
      replaying: 1500,
      resumed: 2000,
    };
    const id = setTimeout(() => {
      if (crashPhase === "crashed") {
        setCrashPhase("replaying");
      } else if (crashPhase === "replaying") {
        setCrashPhase("resumed");
      } else {
        setCrashPhase(null);
        if (runId) startStream(runId);
      }
    }, delays[crashPhase]);
    return () => clearTimeout(id);
  }, [crashPhase, runId, startStream]);

  // --- handlers ---
  const handleStart = useCallback(() => {
    if (phase === "idle") {
      setScores(new Map());
      setFrozenCards(new Set());
      setCallouts([]);
      setDebugEvents([]);
      setLoopCount(0);
      startStream();
    }
  }, [phase, startStream]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
    setCrashPhase(null);
    setCrashCount(0);
    setRunId(undefined);
    setScores(new Map());
    setFrozenCards(new Set());
    setCallouts([]);
    setDebugEvents([]);
    setLoopCount(0);
  }, []);

  const handleKill = useCallback(() => {
    if (isLive) {
      abortRef.current?.abort();
      setCrashPhase("crashed");
      setCrashCount((n) => n + 1);
      setDebugEvents((prev) => [
        ...prev,
        { kind: "ERR", msg: "server down · process killed" },
      ]);
    }
  }, [isLive]);

  useSlideRunReset({ onStart: handleStart, onReset: handleReset });

  const loopNumber = variant.startingLoop + loopCount;

  // --- row state ---
  const rowState = (idx: number): ChargeRowState => {
    const score = scores.get(idx);
    const charge = CHARGES[idx];
    if (!charge) return "hidden";

    if (!score) return "hidden";

    const isFrozen = frozenCards.has(charge.card) && !score.cleared;

    if (isReplaying) {
      return isFrozen ? "cached-frozen" : "cached-cleared";
    }
    if (isResumed) {
      return isFrozen ? "frozen" : "cleared";
    }
    if (isCrashed) {
      return isFrozen ? "frozen" : "cleared";
    }
    return isFrozen ? "frozen" : "cleared";
  };

  // --- last tool call for crash toast ---
  const lastScoredIdx = Math.max(...Array.from(scores.keys()), -1);
  const lastToolCall =
    lastScoredIdx >= 0
      ? `reportCharge(${CHARGES[lastScoredIdx]?.card ?? "…"})`
      : "fetchChargeBatch()";

  const scannedCount = scores.size;
  const frozenCount = frozenCards.size;

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      {/* top strip: counters */}
      <div
        className={`flex items-center justify-between rounded-2xl border bg-zinc-950 px-8 py-5 transition-colors duration-500 ${
          isResumed
            ? "border-emerald-500/40 bg-emerald-500/[0.06]"
            : "border-white/10"
        }`}
      >
        <div className="flex items-center gap-10">
          <Counter
            label="Charges scored"
            value={String(scannedCount)}
            accent={isResumed ? "emerald" : "white"}
          />
          <Counter
            label="Frozen"
            value={String(frozenCount)}
            accent={frozenCount > 0 ? "red" : "zinc"}
          />
          <Counter
            label="Crashes survived"
            value={String(crashCount)}
            accent={crashCount > 0 ? "emerald" : "zinc"}
          />
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`rounded-full border bg-white/5 px-3 py-1 font-mono text-sm tabular-nums transition-opacity duration-500 ${
              isResumed
                ? "border-emerald-400/40 text-emerald-200"
                : "border-white/10 text-zinc-300"
            } ${loopCount > 0 ? "opacity-100" : "opacity-0"}`}
          >
            Loop {loopNumber.toLocaleString()}
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            {variant.uptimeLabel}
          </span>
        </div>
      </div>

      {/* ledger */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        <div className="grid grid-cols-[110px_130px_1fr_120px_60px_260px_140px] gap-4 border-b border-white/10 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          <span>time</span>
          <span>card</span>
          <span>merchant</span>
          <span className="text-right">amount</span>
          <span>country</span>
          <span>risk</span>
          <span>action</span>
        </div>
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgb(63_63_70)_transparent]"
        >
          {CHARGES.map((c, i) => {
            const score = scores.get(i);
            const state = rowState(i);

            return (
              <div key={i}>
                <ChargeRow
                  charge={c}
                  state={state}
                  risk={score?.risk ?? 0}
                />
                {i === 4 && callouts[0] && (
                  <CalloutSlot
                    callout={callouts[0]}
                    state={
                      isReplaying || isResumed
                        ? { kind: "cached" }
                        : { kind: "delivered" }
                    }
                    visible
                  />
                )}
                {i === CHARGES.length - 1 && callouts.length > 1 && (
                  <CalloutSlot
                    callout={callouts[callouts.length - 1]!}
                    state={
                      isReplaying || isResumed
                        ? { kind: "cached" }
                        : { kind: "delivered" }
                    }
                    visible
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* status toast — single slot, bottom-right */}
        <div className="pointer-events-none absolute bottom-6 right-6">
          <span
            className={`absolute bottom-0 right-0 inline-flex items-center gap-3 whitespace-nowrap rounded-2xl border px-6 py-3 font-mono text-lg uppercase tracking-[0.15em] transition-all duration-300 ${
              isCrashed
                ? "translate-y-0 border-red-500/50 bg-red-500/15 text-red-200 opacity-100 shadow-[0_0_32px_rgba(248,113,113,0.5)]"
                : "translate-y-3 border-red-500/50 bg-red-500/15 text-red-200 opacity-0"
            }`}
          >
            <span className={`h-3 w-3 rounded-full bg-red-400 ${isCrashed ? "animate-pulse" : ""}`} />
            Server down · {lastToolCall}
          </span>
          <span
            className={`absolute bottom-0 right-0 inline-flex items-center gap-3 whitespace-nowrap rounded-2xl border px-6 py-3 font-mono text-lg uppercase tracking-[0.15em] transition-all duration-300 ${
              isReplaying
                ? "translate-y-0 border-sky-500/40 bg-sky-500/10 text-sky-200 opacity-100 shadow-[0_0_32px_rgba(56,189,248,0.3)]"
                : "translate-y-3 border-sky-500/40 bg-sky-500/10 text-sky-200 opacity-0"
            }`}
          >
            <span className={`h-3 w-3 rounded-full bg-sky-400 ${isReplaying ? "animate-pulse" : ""}`} />
            Replaying event log · 0 re-executions
          </span>
          <span
            className={`absolute bottom-0 right-0 inline-flex items-center gap-3 whitespace-nowrap rounded-2xl border px-6 py-3 font-mono text-lg uppercase tracking-[0.15em] transition-all duration-300 ${
              isResumed
                ? "translate-y-0 border-emerald-400/50 bg-emerald-500/10 text-emerald-200 opacity-100 shadow-[0_0_32px_rgba(52,211,153,0.4)]"
                : "translate-y-3 border-emerald-400/50 bg-emerald-500/10 text-emerald-200 opacity-0"
            }`}
          >
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
            Auto-recovered · 0 re-executions
          </span>
        </div>

        {/* idle hint */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity duration-500 ${
            phase === "idle" && !crashPhase ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="text-center">
            <p className="text-4xl font-semibold tracking-tight text-white whitespace-pre-line">
              {variant.purposeLine}
            </p>
            <button
              type="button"
              onClick={handleStart}
              className="mt-6 rounded-xl bg-white px-8 py-4 text-lg font-semibold text-black transition-colors hover:bg-zinc-200"
            >
              Start agent
            </button>
          </div>
        </div>
      </div>

      {/* bottom row: debug drawer + kill */}
      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={runId} events={debugEvents} />
        <button
          type="button"
          onClick={handleKill}
          disabled={!isLive}
          className={`shrink-0 rounded-xl px-8 py-4 text-lg font-semibold transition-all duration-300 ${
            isLive
              ? "bg-red-500 text-white shadow-[0_0_40px_rgba(248,113,113,0.6)] hover:bg-red-400"
              : "bg-zinc-900 text-zinc-600 opacity-40 cursor-not-allowed"
          }`}
        >
          {variant.kill.buttonLabel}
        </button>
      </div>
    </div>
  );
}

// --- helpers ------------------------------------------------------------

function CalloutSlot({
  callout,
  state,
  visible,
}: {
  callout: Callout;
  state: CalloutState;
  visible: boolean;
}) {
  return (
    <div
      className={`transition-all duration-500 ${
        visible ? "px-6 py-2 opacity-100" : "h-0 overflow-hidden opacity-0"
      }`}
    >
      <AgentCallout callout={callout} state={state} />
    </div>
  );
}

// --- row ----------------------------------------------------------------

function ChargeRow({
  charge,
  state,
  risk,
}: {
  charge: Charge;
  state: ChargeRowState;
  risk: number;
}) {
  const visible = state !== "hidden";
  const frozen = state === "frozen" || state === "cached-frozen";
  const replaying = state === "cached-cleared" || state === "cached-frozen";

  const riskBarColor = frozen
    ? "from-red-500 to-red-400"
    : "from-zinc-700 to-zinc-600";

  const riskBarWidth = state === "hidden" ? "0%" : `${Math.min(risk * 100, 100)}%`;

  return (
    <div
      className={`grid grid-cols-[110px_130px_1fr_120px_60px_260px_140px] items-center gap-4 border-b border-white/5 transition-all duration-500 ${
        visible ? "px-6 py-2 opacity-100" : "h-0 overflow-hidden opacity-0"
      } ${frozen ? "bg-red-500/5" : ""}`}
    >
      <span className="font-mono text-sm tabular-nums text-zinc-500">
        {charge.time}
      </span>
      <span className="font-mono text-sm text-zinc-300">{charge.card}</span>
      <span className="truncate text-sm text-zinc-200">{charge.merchant}</span>
      <span className="text-right font-mono text-sm tabular-nums text-zinc-100">
        {charge.amount}
      </span>
      <span
        className={`inline-flex items-center justify-center rounded border px-2 py-0.5 font-mono text-xs ${
          charge.country === "US"
            ? "border-zinc-700 text-zinc-400"
            : "border-red-500/50 text-red-300"
        }`}
      >
        {charge.country}
      </span>

      {/* risk bar */}
      <div className="flex items-center gap-3">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full bg-gradient-to-r transition-all duration-700 ${riskBarColor}`}
            style={{ width: riskBarWidth }}
          />
        </div>
        <span
          className={`w-10 text-right font-mono text-xs tabular-nums ${
            frozen ? "text-red-300" : "text-zinc-500"
          }`}
        >
          {state === "hidden" ? "\u2009" : risk.toFixed(2)}
        </span>
      </div>

      {/* action */}
      <div className="flex items-center justify-end gap-2">
        {replaying && (
          <span className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-300">
            cached
          </span>
        )}
        {frozen && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/60 bg-red-500/15 px-3 py-1 font-mono text-xs font-bold uppercase tracking-[0.15em] text-red-200">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            frozen
          </span>
        )}
        {!frozen && !replaying && state !== "hidden" && (
          <span className="font-mono text-xs text-zinc-500">cleared</span>
        )}
      </div>
    </div>
  );
}

// --- counter ------------------------------------------------------------

function Counter({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "white" | "red" | "emerald" | "zinc";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-200"
      : accent === "red"
        ? "text-red-200"
        : accent === "zinc"
          ? "text-zinc-400"
          : "text-white";
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </span>
      <span
        className={`font-mono text-3xl tabular-nums transition-colors duration-500 ${color}`}
      >
        {value}
      </span>
    </div>
  );
}
