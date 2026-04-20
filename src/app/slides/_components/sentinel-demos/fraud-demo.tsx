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
// Rows stream in silently. After 5 clean rows, the fraud agent "speaks up"
// inline with a clear-batch summary. More rows stream; on the high-risk
// row the agent speaks up again with a freeze verdict. Kill arms → crash
// freezes the freeze row mid-score → replay marks callouts as cached →
// resumed shows the final frozen row + emerald stat banner.
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

type Phase = "idle" | "live" | "crashed" | "replaying" | "resumed";

type Frame = {
  loopOffset: number;
  visibleIdx: number;
  scoringIdx: number | null;
  phase: Phase;
  killArmed: boolean;
  delayMs: number;
  c0Chars: number;
  c1Chars: number;
  c0Cached: boolean;
  c1Cached: boolean;
};

const FRAMES: Frame[] = [
  // 0 idle
  { loopOffset: 0, visibleIdx: 0,  scoringIdx: null, phase: "idle",      killArmed: false, delayMs: 0,
    c0Chars: 0, c1Chars: 0, c0Cached: false, c1Cached: false },

  // 1-5 loop 1: rows 0..4 score one-by-one
  { loopOffset: 1, visibleIdx: 1,  scoringIdx: 0,    phase: "live",      killArmed: false, delayMs: 500,
    c0Chars: 0, c1Chars: 0, c0Cached: false, c1Cached: false },
  { loopOffset: 1, visibleIdx: 2,  scoringIdx: 1,    phase: "live",      killArmed: false, delayMs: 500,
    c0Chars: 0, c1Chars: 0, c0Cached: false, c1Cached: false },
  { loopOffset: 1, visibleIdx: 3,  scoringIdx: 2,    phase: "live",      killArmed: false, delayMs: 500,
    c0Chars: 0, c1Chars: 0, c0Cached: false, c1Cached: false },
  { loopOffset: 1, visibleIdx: 4,  scoringIdx: 3,    phase: "live",      killArmed: false, delayMs: 500,
    c0Chars: 0, c1Chars: 0, c0Cached: false, c1Cached: false },
  { loopOffset: 1, visibleIdx: 5,  scoringIdx: 4,    phase: "live",      killArmed: false, delayMs: 600,
    c0Chars: 0, c1Chars: 0, c0Cached: false, c1Cached: false },

  // 6-7 agent speaks up (C0 typewriter → delivered)
  { loopOffset: 1, visibleIdx: 5,  scoringIdx: null, phase: "live",      killArmed: false, delayMs: 550,
    c0Chars: 36, c1Chars: 0, c0Cached: false, c1Cached: false },
  { loopOffset: 1, visibleIdx: 5,  scoringIdx: null, phase: "live",      killArmed: false, delayMs: 900,
    c0Chars: C0_LEN, c1Chars: 0, c0Cached: false, c1Cached: false },

  // 8-12 loop 2: rows 5..9 score
  { loopOffset: 2, visibleIdx: 6,  scoringIdx: 5,    phase: "live",      killArmed: false, delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 0, c0Cached: false, c1Cached: false },
  { loopOffset: 2, visibleIdx: 7,  scoringIdx: 6,    phase: "live",      killArmed: false, delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 0, c0Cached: false, c1Cached: false },
  { loopOffset: 2, visibleIdx: 8,  scoringIdx: 7,    phase: "live",      killArmed: false, delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 0, c0Cached: false, c1Cached: false },
  { loopOffset: 2, visibleIdx: 9,  scoringIdx: 8,    phase: "live",      killArmed: false, delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 0, c0Cached: false, c1Cached: false },
  { loopOffset: 2, visibleIdx: 10, scoringIdx: 9,    phase: "live",      killArmed: false, delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 0, c0Cached: false, c1Cached: false },

  // 13 the freeze row begins scoring
  { loopOffset: 2, visibleIdx: 11, scoringIdx: 10,   phase: "live",      killArmed: false, delayMs: 650,
    c0Chars: C0_LEN, c1Chars: 0, c0Cached: false, c1Cached: false },

  // 14-15 agent speaks up about it (C1 typewriter)
  { loopOffset: 2, visibleIdx: 11, scoringIdx: 10,   phase: "live",      killArmed: false, delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 32, c0Cached: false, c1Cached: false },
  { loopOffset: 2, visibleIdx: 11, scoringIdx: 10,   phase: "live",      killArmed: false, delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 62, c0Cached: false, c1Cached: false },

  // 16 armed: C1 fully delivered, kill pulses, 12s to decide
  { loopOffset: 2, visibleIdx: 11, scoringIdx: 10,   phase: "live",      killArmed: true,  delayMs: 12000,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c0Cached: false, c1Cached: false },

  // 17 crashed
  { loopOffset: 2, visibleIdx: 11, scoringIdx: 10,   phase: "crashed",   killArmed: false, delayMs: 2200,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c0Cached: false, c1Cached: false },

  // 18 replaying: both callouts gain "cached" sigil
  { loopOffset: 2, visibleIdx: 11, scoringIdx: 10,   phase: "replaying", killArmed: false, delayMs: 1800,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c0Cached: true,  c1Cached: true  },

  // 19 resumed
  { loopOffset: 2, visibleIdx: 11, scoringIdx: null, phase: "resumed",   killArmed: false, delayMs: 0,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c0Cached: true,  c1Cached: true  },
];

const CRASH_FRAME = 17;

// --- component ----------------------------------------------------------

export function FraudDemo({ variant }: { variant: SentinelVariant }) {
  const [fi, setFi] = useState(0);
  const frame = FRAMES[fi];
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (frame.delayMs <= 0) return;
    const id = setTimeout(
      () => setFi((i) => Math.min(i + 1, FRAMES.length - 1)),
      frame.delayMs,
    );
    return () => clearTimeout(id);
  }, [fi, frame.delayMs]);

  // auto-scroll the ledger to keep the newest row/callout in view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [fi]);

  const handleStart = useCallback(() => {
    setFi((i) => (i === 0 ? 1 : i));
  }, []);
  const handleReset = useCallback(() => setFi(0), []);
  const handleKill = useCallback(() => {
    if (frame.killArmed) setFi(CRASH_FRAME);
  }, [frame.killArmed]);

  useSlideRunReset({ onStart: handleStart, onReset: handleReset });
  const runId = useObserverRunId(fi > 0);

  const isResumed = frame.phase === "resumed";
  const isCrashed = frame.phase === "crashed";
  const isReplaying = frame.phase === "replaying";
  const loopNumber = variant.startingLoop + Math.max(0, frame.loopOffset - 1);

  const rowState = (idx: number): ChargeRowState => {
    if (idx >= frame.visibleIdx && frame.scoringIdx !== idx) return "hidden";
    if (isReplaying) {
      if (idx < FREEZE_IDX) {
        return CHARGES[idx].risk > 0.9 ? "cached-frozen" : "cached-cleared";
      }
      return "scoring";
    }
    if (isResumed) {
      if (idx === FREEZE_IDX) return "frozen";
      return CHARGES[idx].risk > 0.9 ? "frozen" : "cleared";
    }
    if (isCrashed) {
      if (idx === frame.scoringIdx) return "scoring";
      return CHARGES[idx].risk > 0.9 ? "frozen" : "cleared";
    }
    if (frame.scoringIdx === idx) return "scoring";
    return CHARGES[idx].risk > 0.9 ? "frozen" : "cleared";
  };

  const c0State = calloutState(frame.c0Chars, frame.c0Cached, C0_LEN);
  const c1State = calloutState(frame.c1Chars, frame.c1Cached, C1_LEN);
  const c0Visible = frame.c0Chars > 0 || frame.c0Cached;
  const c1Visible = frame.c1Chars > 0 || frame.c1Cached;

  const scanned = 42_804_192 + fi * 417;
  const frozen = 1_248 + (isResumed ? 1 : 0);

  const debugEvents: DebugEvent[] = useMemo(() => {
    const out: DebugEvent[] = [];
    if (fi === 0) return out;
    out.push({ kind: "RUN", msg: `scanCharges(window: 60s)` });
    for (let i = 1; i <= fi; i++) {
      const fr = FRAMES[i];
      const prev = FRAMES[i - 1];
      if (!fr) break;
      if (fr.scoringIdx !== null && prev?.scoringIdx !== fr.scoringIdx) {
        const c = CHARGES[fr.scoringIdx];
        if (c) out.push({ kind: "RUN", msg: `scoreRisk(${c.card} · ${c.amount})` });
      }
      if (fr.c0Chars >= C0_LEN && (prev?.c0Chars ?? 0) < C0_LEN) {
        out.push({ kind: "CMP", msg: `assess(batch: 5 cleared)` });
      }
      if (fr.c1Chars >= C1_LEN && (prev?.c1Chars ?? 0) < C1_LEN) {
        out.push({ kind: "CMP", msg: `assess(•••• 8891: risk 0.93)` });
      }
      if (fr.phase === "crashed" && prev?.phase !== "crashed") {
        out.push({ kind: "ERR", msg: `server down · process killed` });
      }
      if (fr.phase === "replaying" && prev?.phase !== "replaying") {
        out.push({ kind: "RPL", msg: `replaying event log…` });
      }
      if (fr.phase === "resumed" && prev?.phase !== "resumed") {
        out.push({ kind: "OK ", msg: `freezeAccount(•••• 8891)` });
        out.push({ kind: "END", msg: `resumed · 0 steps re-executed` });
      }
    }
    return out;
  }, [fi]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      {/* top strip: counters */}
      <div
        className={`flex items-center justify-between rounded-2xl border bg-zinc-950 px-8 py-5 transition-colors duration-500 ${
          isResumed ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-white/10"
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
            label="p99 score"
            value="47ms"
            accent="zinc"
          />
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`rounded-full border bg-white/5 px-3 py-1 font-mono text-sm tabular-nums transition-opacity duration-500 ${
              isResumed ? "border-emerald-400/40 text-emerald-200" : "border-white/10 text-zinc-300"
            } ${frame.loopOffset > 0 ? "opacity-100" : "opacity-0"}`}
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

        {/* crashed overlay */}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-red-500/15 backdrop-blur-[1px] transition-opacity duration-300 ${
            isCrashed ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="rounded-2xl border-2 border-red-500/60 bg-black/80 px-10 py-6 text-center shadow-[0_0_80px_rgba(248,113,113,0.5)]">
            <p className="font-mono text-sm uppercase tracking-[0.3em] text-red-400">
              server down
            </p>
            <p className="mt-2 text-4xl font-semibold text-red-200">
              Process killed mid-score
            </p>
            <p className="mt-3 text-sm text-zinc-400">
              Event log intact. Last tool call: <span className="font-mono text-red-300">scoreRisk(•••• 8891)</span>
            </p>
          </div>
        </div>

        {/* replaying overlay (non-blocking) */}
        <div
          className={`pointer-events-none absolute top-4 right-4 transition-opacity duration-300 ${
            isReplaying ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-sky-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
            replaying event log · 0 re-executions
          </span>
        </div>

        {/* idle hint */}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity duration-500 ${
            fi === 0 ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-red-400">
              {variant.eyebrow}
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {variant.purposeLine}
            </p>
            <p className="mt-4 text-base text-zinc-400">
              Press <kbd className="mx-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-base">r</kbd> to peek at one loop.
            </p>
          </div>
        </div>
      </div>

      {/* resumed banner */}
      <div
        className={`pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 transition-all duration-700 ${
          isResumed ? "opacity-100 translate-y-0" : "-translate-y-4 opacity-0"
        }`}
      >
        <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 px-10 py-5 text-center shadow-[0_0_60px_rgba(52,211,153,0.45)]">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-300">
            crash survived
          </p>
          <p className="mt-2 text-3xl font-semibold text-emerald-100">
            {variant.resumed.headline}
          </p>
          <p className="mt-2 font-mono text-sm text-emerald-200">
            {variant.resumed.statChip}
          </p>
        </div>
      </div>

      {/* bottom row: debug drawer + kill */}
      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={runId} events={debugEvents} />
        <button
          type="button"
          onClick={handleKill}
          disabled={!frame.killArmed}
          className={`shrink-0 rounded-xl px-8 py-4 text-lg font-semibold transition-all duration-300 ${
            frame.killArmed
              ? "bg-red-500 text-white shadow-[0_0_40px_rgba(248,113,113,0.6)] hover:bg-red-400 animate-pulse"
              : "bg-zinc-900 text-zinc-600 opacity-40 cursor-not-allowed"
          }`}
        >
          ⚡ {variant.kill.buttonLabel}
        </button>
      </div>
    </div>
  );
}

// --- helpers ------------------------------------------------------------

function calloutState(
  chars: number,
  cached: boolean,
  msgLen: number,
): CalloutState {
  if (cached) return { kind: "cached" };
  if (chars >= msgLen) return { kind: "delivered" };
  return { kind: "typing", chars };
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
      <span className="font-mono text-sm tabular-nums text-zinc-500">{charge.time}</span>
      <span className="font-mono text-sm text-zinc-300">{charge.card}</span>
      <span className="truncate text-sm text-zinc-200">{charge.merchant}</span>
      <span className="text-right font-mono text-sm tabular-nums text-zinc-100">{charge.amount}</span>
      <span
        className={`inline-flex items-center justify-center rounded border px-2 py-0.5 font-mono text-xs ${
          charge.country === "US" ? "border-zinc-700 text-zinc-400" : "border-red-500/50 text-red-300"
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
      <span className={`font-mono text-3xl tabular-nums transition-colors duration-500 ${color}`}>
        {value}
      </span>
    </div>
  );
}
