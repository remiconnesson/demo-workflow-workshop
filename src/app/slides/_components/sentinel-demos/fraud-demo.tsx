"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentDebugDrawer, type DebugEvent } from "../agent-debug-drawer";
import type { SentinelVariant } from "../../_data/sentinel-variants";
import { useObserverRunId, useSlideRunReset } from "./_shared";
import {
  AgentCallout,
  type Callout,
  type CalloutState,
} from "./_agent-callout";

// ---------------------------------------------------------------------------
// Fraud sentinel: live charge ledger + inline AI callouts.
//
// Kill is always available while streaming. Crash auto-recovers:
// crashed (2.2s) → replaying (1.5s) → resumed (2s) → continues from
// where it left off. The batch loops so the presenter can crash it
// multiple times; a crash counter in the stats bar tracks survivals.
// ---------------------------------------------------------------------------

type ChargeRowState =
  | "hidden"
  | "scoring"
  | "cleared"
  | "frozen"
  | "replaying"
  | "cached-cleared"
  | "cached-frozen";

type Charge = {
  time: string;
  card: string;
  merchant: string;
  amount: string;
  country: string;
  risk: number;
};

const CHARGES: Charge[] = [
  { time: "14:32:01", card: "•••• 4242", merchant: "Apple Services",     amount: "$12.99",    country: "US", risk: 0.08 },
  { time: "14:32:02", card: "•••• 1117", merchant: "Uber Trip",           amount: "$24.40",    country: "US", risk: 0.11 },
  { time: "14:32:03", card: "•••• 9003", merchant: "Target",              amount: "$87.20",    country: "US", risk: 0.06 },
  { time: "14:32:04", card: "•••• 5541", merchant: "Starbucks #4812",     amount: "$6.80",     country: "US", risk: 0.04 },
  { time: "14:32:05", card: "•••• 2200", merchant: "Shell Oil",           amount: "$48.10",    country: "US", risk: 0.12 },
  { time: "14:32:07", card: "•••• 3384", merchant: "DoorDash",            amount: "$31.42",    country: "US", risk: 0.09 },
  { time: "14:32:08", card: "•••• 7719", merchant: "Netflix",             amount: "$17.99",    country: "US", risk: 0.02 },
  { time: "14:32:10", card: "•••• 6106", merchant: "Amazon Prime",        amount: "$139.00",   country: "US", risk: 0.21 },
  { time: "14:32:11", card: "•••• 0458", merchant: "Home Depot",          amount: "$412.88",   country: "US", risk: 0.34 },
  { time: "14:32:12", card: "•••• 4242", merchant: "Apple Services",      amount: "$0.99",     country: "US", risk: 0.05 },
  { time: "14:32:13", card: "•••• 8891", merchant: "Cryptonome-XYZ",      amount: "$2,400.00", country: "RU", risk: 0.93 },
];

const FREEZE_IDX = CHARGES.length - 1;

const CALLOUT_C0: Callout = {
  id: "c0",
  avatar: "F",
  agentName: "Fraud sentinel",
  timestamp: "14:32:06",
  tone: "emerald",
  message:
    "Last 5 charges clear: low-risk cards, familiar merchants, no geo anomalies.",
  citations: ["•••• 4242", "•••• 1117", "•••• 9003"],
  verdict: "cleared 5",
};

const CALLOUT_C1: Callout = {
  id: "c1",
  avatar: "F",
  agentName: "Fraud sentinel",
  timestamp: "14:32:13",
  tone: "red",
  message:
    "Freezing •••• 8891. First charge at Cryptonome-XYZ, 3× typical amount, RU merchant mid-day.",
  citations: ["•••• 8891", "Cryptonome-XYZ"],
  verdict: "froze •••• 8891",
};

const C0_LEN = CALLOUT_C0.message.length;
const C1_LEN = CALLOUT_C1.message.length;

// ---------------------------------------------------------------------------
// Frame table — live streaming only (no crash/replay/resumed frames).
// Crash sequence is handled dynamically via crashPhase state.
// ---------------------------------------------------------------------------

type Frame = {
  loopOffset: number;
  visibleIdx: number;
  scoringIdx: number | null;
  delayMs: number;
  c0Chars: number;
  c1Chars: number;
};

const FRAMES: Frame[] = [
  // 0 idle
  { loopOffset: 0, visibleIdx: 0,  scoringIdx: null, delayMs: 0,
    c0Chars: 0, c1Chars: 0 },

  // 1-5 rows 0..4 score one-by-one
  { loopOffset: 1, visibleIdx: 1,  scoringIdx: 0,    delayMs: 500,
    c0Chars: 0, c1Chars: 0 },
  { loopOffset: 1, visibleIdx: 2,  scoringIdx: 1,    delayMs: 500,
    c0Chars: 0, c1Chars: 0 },
  { loopOffset: 1, visibleIdx: 3,  scoringIdx: 2,    delayMs: 500,
    c0Chars: 0, c1Chars: 0 },
  { loopOffset: 1, visibleIdx: 4,  scoringIdx: 3,    delayMs: 500,
    c0Chars: 0, c1Chars: 0 },
  { loopOffset: 1, visibleIdx: 5,  scoringIdx: 4,    delayMs: 600,
    c0Chars: 0, c1Chars: 0 },

  // 6-7 agent speaks up (C0 typewriter → delivered)
  { loopOffset: 1, visibleIdx: 5,  scoringIdx: null, delayMs: 550,
    c0Chars: 36, c1Chars: 0 },
  { loopOffset: 1, visibleIdx: 5,  scoringIdx: null, delayMs: 900,
    c0Chars: C0_LEN, c1Chars: 0 },

  // 8-12 rows 5..9 score
  { loopOffset: 2, visibleIdx: 6,  scoringIdx: 5,    delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 0 },
  { loopOffset: 2, visibleIdx: 7,  scoringIdx: 6,    delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 0 },
  { loopOffset: 2, visibleIdx: 8,  scoringIdx: 7,    delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 0 },
  { loopOffset: 2, visibleIdx: 9,  scoringIdx: 8,    delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 0 },
  { loopOffset: 2, visibleIdx: 10, scoringIdx: 9,    delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 0 },

  // 13 freeze row begins scoring
  { loopOffset: 2, visibleIdx: 11, scoringIdx: 10,   delayMs: 650,
    c0Chars: C0_LEN, c1Chars: 0 },

  // 14-15 agent speaks up (C1 typewriter)
  { loopOffset: 2, visibleIdx: 11, scoringIdx: 10,   delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 32 },
  { loopOffset: 2, visibleIdx: 11, scoringIdx: 10,   delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 62 },

  // 16 C1 fully delivered, brief hold
  { loopOffset: 2, visibleIdx: 11, scoringIdx: 10,   delayMs: 1500,
    c0Chars: C0_LEN, c1Chars: C1_LEN },

  // 17 batch complete: freeze row resolves
  { loopOffset: 2, visibleIdx: 11, scoringIdx: null,  delayMs: 3000,
    c0Chars: C0_LEN, c1Chars: C1_LEN },
];

const LAST_LIVE = FRAMES.length - 1; // 17

// --- component ----------------------------------------------------------

type CrashPhase = "crashed" | "replaying" | "resumed";

export function FraudDemo({ variant }: { variant: SentinelVariant }) {
  const [fi, setFi] = useState(0);
  const [crashPhase, setCrashPhase] = useState<CrashPhase | null>(null);
  const [crashFi, setCrashFi] = useState(0);
  const [crashCount, setCrashCount] = useState(0);
  const [loopExtra, setLoopExtra] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const frame = FRAMES[crashPhase ? crashFi : fi]!;
  const isLive = fi > 0 && !crashPhase;
  const isCrashed = crashPhase === "crashed";
  const isReplaying = crashPhase === "replaying";
  const isResumed = crashPhase === "resumed";

  // --- auto-advance live frames ---
  useEffect(() => {
    if (crashPhase) return;
    if (frame.delayMs <= 0) return;
    const id = setTimeout(() => {
      setFi((i) => {
        if (i >= LAST_LIVE) {
          setLoopExtra((n) => n + 1);
          return 1;
        }
        return i + 1;
      });
    }, frame.delayMs);
    return () => clearTimeout(id);
  }, [fi, frame.delayMs, crashPhase]);

  // --- crash auto-recovery ---
  useEffect(() => {
    if (!crashPhase) return;
    const delays: Record<CrashPhase, number> = {
      crashed: 2200,
      replaying: 1500,
      resumed: 2000,
    };
    const id = setTimeout(() => {
      if (crashPhase === "crashed") setCrashPhase("replaying");
      else if (crashPhase === "replaying") setCrashPhase("resumed");
      else {
        setCrashPhase(null);
        // fi is still at crash point; auto-advance picks up from there
      }
    }, delays[crashPhase]);
    return () => clearTimeout(id);
  }, [crashPhase]);

  // auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [fi]);

  const handleStart = useCallback(() => {
    setFi((i) => (i === 0 ? 1 : i));
  }, []);
  const handleReset = useCallback(() => {
    setFi(0);
    setCrashPhase(null);
    setCrashCount(0);
    setLoopExtra(0);
  }, []);
  const handleKill = useCallback(() => {
    if (isLive) {
      setCrashFi(fi);
      setCrashPhase("crashed");
      setCrashCount((n) => n + 1);
    }
  }, [isLive, fi]);

  useSlideRunReset({ onStart: handleStart, onReset: handleReset });
  const runId = useObserverRunId(fi > 0);

  const loopNumber =
    variant.startingLoop + Math.max(0, frame.loopOffset - 1) + loopExtra;

  // --- row state (phase-aware) ---
  const rowState = (idx: number): ChargeRowState => {
    if (idx >= frame.visibleIdx && frame.scoringIdx !== idx) return "hidden";
    if (isReplaying) {
      if (idx === frame.scoringIdx) return "scoring";
      return CHARGES[idx].risk > 0.9 ? "cached-frozen" : "cached-cleared";
    }
    if (isResumed) {
      return CHARGES[idx].risk > 0.9 ? "frozen" : "cleared";
    }
    if (isCrashed) {
      if (idx === frame.scoringIdx) return "scoring";
      return CHARGES[idx].risk > 0.9 ? "frozen" : "cleared";
    }
    if (frame.scoringIdx === idx) return "scoring";
    return CHARGES[idx].risk > 0.9 ? "frozen" : "cleared";
  };

  // --- callout state (phase-aware) ---
  const crashCached = isReplaying || isResumed;
  const c0State: CalloutState =
    crashCached && frame.c0Chars > 0
      ? { kind: "cached" }
      : calloutState(frame.c0Chars, C0_LEN);
  const c1State: CalloutState =
    crashCached && frame.c1Chars > 0
      ? { kind: "cached" }
      : calloutState(frame.c1Chars, C1_LEN);
  const c0Visible = frame.c0Chars > 0;
  const c1Visible = frame.c1Chars > 0;

  const scanned = 42_804_192 + fi * 417;
  const frozen = 1_248 + (isResumed ? 1 : 0);

  // --- crash overlay: dynamic last-tool-call ---
  const crashScoringIdx = FRAMES[crashFi]?.scoringIdx;
  const lastToolCall =
    crashScoringIdx !== null && crashScoringIdx !== undefined
      ? `scoreRisk(${CHARGES[crashScoringIdx]?.card ?? "…"})`
      : "assess(batch)";

  // --- debug events ---
  const debugEvents: DebugEvent[] = useMemo(() => {
    const out: DebugEvent[] = [];
    if (fi === 0 && !crashPhase) return out;
    const end = crashPhase ? crashFi : fi;
    out.push({ kind: "RUN", msg: `scanCharges(window: 60s)` });
    for (let i = 1; i <= end; i++) {
      const fr = FRAMES[i];
      const prev = FRAMES[i - 1];
      if (!fr) break;
      if (fr.scoringIdx !== null && prev?.scoringIdx !== fr.scoringIdx) {
        const c = CHARGES[fr.scoringIdx];
        if (c)
          out.push({
            kind: "RUN",
            msg: `scoreRisk(${c.card} · ${c.amount})`,
          });
      }
      if (fr.c0Chars >= C0_LEN && (prev?.c0Chars ?? 0) < C0_LEN) {
        out.push({ kind: "CMP", msg: `assess(batch: 5 cleared)` });
      }
      if (fr.c1Chars >= C1_LEN && (prev?.c1Chars ?? 0) < C1_LEN) {
        out.push({ kind: "CMP", msg: `assess(•••• 8891: risk 0.93)` });
      }
    }
    if (crashPhase) {
      out.push({ kind: "ERR", msg: `server down · process killed` });
    }
    if (isReplaying || isResumed) {
      out.push({ kind: "RPL", msg: `replaying event log…` });
    }
    if (isResumed) {
      out.push({ kind: "OK ", msg: `resumed · 0 steps re-executed` });
    }
    return out;
  }, [fi, crashPhase, crashFi, isReplaying, isResumed]);

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
            label="Scanned today"
            value={`$${scanned.toLocaleString()}`}
            accent={isResumed ? "emerald" : "white"}
          />
          <Counter
            label="Frozen"
            value={frozen.toLocaleString()}
            accent={isResumed ? "emerald" : "red"}
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
            } ${frame.loopOffset > 0 || loopExtra > 0 ? "opacity-100" : "opacity-0"}`}
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
          {CHARGES.slice(0, 5).map((c, i) => (
            <ChargeRow key={i} charge={c} state={rowState(i)} />
          ))}

          <CalloutSlot
            callout={CALLOUT_C0}
            state={c0State}
            visible={c0Visible}
          />

          {CHARGES.slice(5, 11).map((c, i) => (
            <ChargeRow key={i + 5} charge={c} state={rowState(i + 5)} />
          ))}

          <CalloutSlot
            callout={CALLOUT_C1}
            state={c1State}
            visible={c1Visible}
          />
        </div>

        {/* status toast — one slot, three states */}
        <div className="pointer-events-none absolute top-4 right-4 flex flex-col items-end gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] transition-all duration-300 ${
              isCrashed
                ? "border-red-500/50 bg-red-500/15 text-red-200 opacity-100 shadow-[0_0_24px_rgba(248,113,113,0.4)]"
                : "border-red-500/50 bg-red-500/15 text-red-200 opacity-0"
            }`}
          >
            <span className={`h-2 w-2 rounded-full bg-red-400 ${isCrashed ? "animate-pulse" : ""}`} />
            server down · {lastToolCall}
          </span>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] transition-all duration-300 ${
              isReplaying
                ? "border-sky-500/40 bg-sky-500/10 text-sky-200 opacity-100"
                : "border-sky-500/40 bg-sky-500/10 text-sky-200 opacity-0"
            }`}
          >
            <span className={`h-2 w-2 rounded-full bg-sky-400 ${isReplaying ? "animate-pulse" : ""}`} />
            replaying event log · 0 re-executions
          </span>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] transition-all duration-300 ${
              isResumed
                ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200 opacity-100 shadow-[0_0_24px_rgba(52,211,153,0.35)]"
                : "border-emerald-400/50 bg-emerald-500/10 text-emerald-200 opacity-0"
            }`}
          >
            <span className={`h-2 w-2 rounded-full bg-emerald-400`} />
            auto-recovered · 0 re-executions
          </span>
        </div>

        {/* idle hint */}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity duration-500 ${
            fi === 0 && !crashPhase ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="text-center">
            <p className="text-4xl font-semibold tracking-tight text-white whitespace-pre-line">
              {variant.purposeLine}
            </p>
            <p className="mt-4 text-base text-zinc-400">
              Press{" "}
              <kbd className="mx-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-base">
                r
              </kbd>{" "}
              to start the agent loop.
            </p>
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

function calloutState(chars: number, msgLen: number): CalloutState {
  if (chars >= msgLen) return { kind: "delivered" };
  if (chars > 0) return { kind: "typing", chars };
  return { kind: "typing", chars: 0 };
}

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
      className={`px-6 py-2 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
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
}: {
  charge: Charge;
  state: ChargeRowState;
}) {
  const visible = state !== "hidden";
  const scoring = state === "scoring";
  const frozen = state === "frozen" || state === "cached-frozen";
  const replaying = state === "cached-cleared" || state === "cached-frozen";

  const riskBarColor = frozen
    ? "from-red-500 to-red-400"
    : scoring
      ? "from-sky-500 to-sky-300"
      : "from-zinc-700 to-zinc-600";

  const riskBarWidth = scoring
    ? `${Math.min(charge.risk * 100, 95)}%`
    : state === "hidden"
      ? "0%"
      : `${charge.risk * 100}%`;

  return (
    <div
      className={`grid grid-cols-[110px_130px_1fr_120px_60px_260px_140px] items-center gap-4 border-b border-white/5 px-6 py-2 transition-all duration-500 ${
        visible ? "opacity-100" : "opacity-0"
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
            frozen ? "text-red-300" : scoring ? "text-sky-300" : "text-zinc-500"
          }`}
        >
          {state === "hidden" ? "\u2009" : charge.risk.toFixed(2)}
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
        {!frozen && !replaying && scoring && (
          <span className="font-mono text-xs text-sky-300">scoring…</span>
        )}
        {!frozen && !replaying && !scoring && state !== "hidden" && (
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
