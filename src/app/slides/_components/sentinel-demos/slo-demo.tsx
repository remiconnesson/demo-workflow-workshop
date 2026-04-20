"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentDebugDrawer, type DebugEvent } from "../agent-debug-drawer";
import type { SentinelVariant } from "../../_data/sentinel-variants";
import { useObserverRunId, useSlideRunReset } from "./_shared";
import {
  AgentCallout,
  type Callout,
  type CalloutState,
} from "./_agent-callout";

// ---------------------------------------------------------------------------
// SLO watchdog: 3-tile metrics dashboard + AI thread.
// Sparkline (p99) · gauge (error %) · area (error-budget burn).
// Below the tiles: a 3-callout thread (watching → correlating → paged)
// fades in as the agent reasons. Crash freezes the thread mid-beat.
// Replay caches the first two; resumed delivers the paged verdict.
// ---------------------------------------------------------------------------

type Phase = "idle" | "live" | "crashed" | "replaying" | "resumed";

type Frame = {
  points: number;
  p99: number;
  errorPct: number;
  budgetLeft: number;
  phase: Phase;
  killArmed: boolean;
  pageSent: boolean;
  loopOffset: number;
  delayMs: number;
  c0Chars: number;
  c1Chars: number;
  c2Chars: number;
  c0Cached: boolean;
  c1Cached: boolean;
  c2Cached: boolean;
};

const P99_SERIES = [
  240, 235, 246, 252, 238, 260, 268, 252, 270, 282,
  266, 275, 290, 312, 340, 405, 520, 690, 880, 1080,
  1240, 1320, 1280, 1260, 1240, 1240, 1240, 1240, 1240, 1240,
];
const P99_MAX = 1400;
const P99_THRESHOLD = 1200;

const CALLOUT_C0: Callout = {
  id: "c0",
  avatar: "S",
  agentName: "SLO watchdog",
  timestamp: "14:30:18",
  tone: "sky",
  message:
    "p99 climbing on api-gateway: 240 → 405ms over 4m. Not a single endpoint, full fleet.",
  citations: ["api-gateway", "p99 +68%"],
  verdict: "watching",
};

const CALLOUT_C1: Callout = {
  id: "c1",
  avatar: "S",
  agentName: "SLO watchdog",
  timestamp: "14:31:07",
  tone: "amber",
  message:
    "Regression matches deploy api-gateway@2.3.1 (shipped 7m ago). Errors 6× baseline, budget burning.",
  citations: ["api-gateway@2.3.1", "errors 6×"],
  verdict: "correlated",
};

const CALLOUT_C2: Callout = {
  id: "c2",
  avatar: "S",
  agentName: "SLO watchdog",
  timestamp: "14:32:01",
  tone: "red",
  message:
    "Paging Priya Chen severity-2. Rollback runbook attached, incident #INC-8421 open.",
  citations: ["@priya", "#INC-8421"],
  verdict: "paged",
};

const C0_LEN = CALLOUT_C0.message.length;
const C1_LEN = CALLOUT_C1.message.length;
const C2_LEN = CALLOUT_C2.message.length;

const BASE = { c0Chars: 0, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false };

const FRAMES: Frame[] = [
  // 0 idle
  { points: 0,  p99: 240,  errorPct: 0.2,  budgetLeft: 94, phase: "idle",      killArmed: false, pageSent: false, loopOffset: 0, delayMs: 0,    ...BASE },

  // 1-2 loop 1: metrics stable, climbing mildly
  { points: 4,  p99: 252,  errorPct: 0.3,  budgetLeft: 94, phase: "live",      killArmed: false, pageSent: false, loopOffset: 1, delayMs: 700,  ...BASE },
  { points: 8,  p99: 270,  errorPct: 0.4,  budgetLeft: 93, phase: "live",      killArmed: false, pageSent: false, loopOffset: 1, delayMs: 700,  ...BASE },

  // 3-4 C0 speaks up (watching)
  { points: 8,  p99: 270,  errorPct: 0.4,  budgetLeft: 93, phase: "live",      killArmed: false, pageSent: false, loopOffset: 1, delayMs: 500,
    c0Chars: 36, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },
  { points: 8,  p99: 270,  errorPct: 0.4,  budgetLeft: 93, phase: "live",      killArmed: false, pageSent: false, loopOffset: 1, delayMs: 800,
    c0Chars: C0_LEN, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },

  // 5-6 loop 2: regression starts
  { points: 12, p99: 290,  errorPct: 0.6,  budgetLeft: 92, phase: "live",      killArmed: false, pageSent: false, loopOffset: 2, delayMs: 700,
    c0Chars: C0_LEN, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },
  { points: 16, p99: 405,  errorPct: 1.8,  budgetLeft: 87, phase: "live",      killArmed: false, pageSent: false, loopOffset: 2, delayMs: 700,
    c0Chars: C0_LEN, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },

  // 7-8 C1 speaks up (correlating)
  { points: 16, p99: 405,  errorPct: 1.8,  budgetLeft: 87, phase: "live",      killArmed: false, pageSent: false, loopOffset: 2, delayMs: 550,
    c0Chars: C0_LEN, c1Chars: 40, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },
  { points: 16, p99: 405,  errorPct: 1.8,  budgetLeft: 87, phase: "live",      killArmed: false, pageSent: false, loopOffset: 2, delayMs: 900,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },

  // 9 spike deepens
  { points: 19, p99: 880,  errorPct: 4.2,  budgetLeft: 66, phase: "live",      killArmed: false, pageSent: false, loopOffset: 2, delayMs: 700,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },

  // 10 armed: red zone, kill pulses, 12s
  { points: 20, p99: 1080, errorPct: 6.1,  budgetLeft: 38, phase: "live",      killArmed: true,  pageSent: false, loopOffset: 2, delayMs: 12000,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },

  // 11 crashed: tiles freeze, C2 still pending
  { points: 20, p99: 1080, errorPct: 6.1,  budgetLeft: 38, phase: "crashed",   killArmed: false, pageSent: false, loopOffset: 2, delayMs: 2200,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },

  // 12 replaying: first two callouts gain cached sigils
  { points: 20, p99: 1080, errorPct: 6.1,  budgetLeft: 38, phase: "replaying", killArmed: false, pageSent: false, loopOffset: 2, delayMs: 1800,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: true, c1Cached: true, c2Cached: false },

  // 13 resumed: pending page fires, C2 delivers
  { points: 24, p99: 1240, errorPct: 7.4,  budgetLeft: 12, phase: "resumed",   killArmed: false, pageSent: true,  loopOffset: 2, delayMs: 0,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: C2_LEN, c0Cached: true, c1Cached: true, c2Cached: false },
];

const CRASH_FRAME = 11;

// --- component ----------------------------------------------------------

export function SloDemo({ variant }: { variant: SentinelVariant }) {
  const [fi, setFi] = useState(0);
  const frame = FRAMES[fi];

  useEffect(() => {
    if (frame.delayMs <= 0) return;
    const id = setTimeout(
      () => setFi((i) => Math.min(i + 1, FRAMES.length - 1)),
      frame.delayMs,
    );
    return () => clearTimeout(id);
  }, [fi, frame.delayMs]);

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

  const sirenTone =
    isResumed ? "emerald"
    : frame.killArmed ? "red"
    : frame.budgetLeft < 70 ? "amber"
    : "zinc";

  const c0State = calloutState(frame.c0Chars, frame.c0Cached, C0_LEN);
  const c1State = calloutState(frame.c1Chars, frame.c1Cached, C1_LEN);
  const c2State = calloutState(frame.c2Chars, frame.c2Cached, C2_LEN);
  const c0Visible = frame.c0Chars > 0 || frame.c0Cached;
  const c1Visible = frame.c1Chars > 0 || frame.c1Cached;
  const c2Visible = frame.c2Chars > 0 || frame.c2Cached;

  const debugEvents: DebugEvent[] = useMemo(() => {
    const out: DebugEvent[] = [];
    if (fi === 0) return out;
    for (let i = 1; i <= fi; i++) {
      const fr = FRAMES[i];
      const prev = FRAMES[i - 1];
      if (!fr) break;
      if (fr.phase === "live" && prev?.phase !== "live") {
        out.push({ kind: "RUN", msg: `readMetrics(window: 2m)` });
      }
      if (fr.c0Chars >= C0_LEN && (prev?.c0Chars ?? 0) < C0_LEN) {
        out.push({ kind: "CMP", msg: `detectTrend(api-gateway) → climbing` });
      }
      if (fr.c1Chars >= C1_LEN && (prev?.c1Chars ?? 0) < C1_LEN) {
        out.push({ kind: "CMP", msg: `correlateDeploy(2.3.1) → regression` });
      }
      if (fr.killArmed && !prev?.killArmed) {
        out.push({ kind: "RUN", msg: `detectRegression(baseline: 14d) → regressed` });
      }
      if (fr.phase === "crashed" && prev?.phase !== "crashed") {
        out.push({ kind: "ERR", msg: `server down · pageOncall pending` });
      }
      if (fr.phase === "replaying" && prev?.phase !== "replaying") {
        out.push({ kind: "RPL", msg: `replaying event log…` });
      }
      if (fr.phase === "resumed" && prev?.phase !== "resumed") {
        out.push({ kind: "OK ", msg: `pageOncall(severity: 2) · on-call: Priya Chen` });
        out.push({ kind: "END", msg: `resumed · 0 duplicate pages` });
      }
    }
    return out;
  }, [fi]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      {/* top strip */}
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950 px-8 py-5">
        <div className="flex items-center gap-5">
          <SirenIcon tone={sirenTone} />
          <div className="flex flex-col">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              {variant.agentName}
            </span>
            <span className="text-2xl font-semibold tracking-tight text-white">
              Production health · live
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-sm tabular-nums text-zinc-300 transition-opacity duration-500 ${
              frame.loopOffset > 0 ? "opacity-100" : "opacity-0"
            }`}
          >
            Loop {loopNumber.toLocaleString()}
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            {variant.uptimeLabel}
          </span>
        </div>
      </div>

      {/* 3 tiles */}
      <div className="relative grid min-h-0 flex-1 grid-cols-3 gap-4">
        <Tile label="p99 latency · api-gateway" value={`${frame.p99}ms`} critical={frame.p99 >= P99_THRESHOLD}>
          <Sparkline points={frame.points} />
        </Tile>
        <Tile
          label="error rate · 5m window"
          value={`${frame.errorPct.toFixed(1)}%`}
          critical={frame.errorPct > 3}
        >
          <Gauge value={frame.errorPct} max={10} />
        </Tile>
        <Tile
          label="error budget · 30d"
          value={`${frame.budgetLeft}%`}
          critical={frame.budgetLeft < 40}
        >
          <BurnDown value={frame.budgetLeft} />
        </Tile>

        {/* crashed overlay */}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl transition-opacity duration-300 ${
            isCrashed ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className="absolute inset-0 bg-red-500/15"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(248,113,113,0.2) 0, rgba(248,113,113,0.2) 16px, transparent 16px, transparent 32px)",
            }}
          />
          <div className="relative rounded-2xl border-2 border-red-500/60 bg-black/85 px-10 py-6 text-center shadow-[0_0_80px_rgba(248,113,113,0.5)]">
            <p className="font-mono text-sm uppercase tracking-[0.3em] text-red-400">metrics offline</p>
            <p className="mt-2 text-4xl font-semibold text-red-200">Pipeline crashed</p>
            <p className="mt-3 text-sm text-zinc-400">
              <span className="font-mono text-red-300">pageOncall</span> was pending. Event log intact.
            </p>
          </div>
        </div>

        {/* replaying chip */}
        <div
          className={`pointer-events-none absolute top-4 right-4 transition-opacity duration-300 ${
            isReplaying ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-sky-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
            replaying event log · idempotent
          </span>
        </div>

        {/* idle hint */}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 transition-opacity duration-500 ${
            fi === 0 ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-400">
              {variant.eyebrow}
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {variant.purposeLine}
            </p>
            <p className="mt-4 text-base text-zinc-400">
              Press <kbd className="mx-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-base">r</kbd> to watch the sky fall.
            </p>
          </div>
        </div>
      </div>

      {/* agent thread, below tiles */}
      <div className="grid grid-cols-3 gap-4">
        <CalloutSlot callout={CALLOUT_C0} state={c0State} visible={c0Visible} />
        <CalloutSlot callout={CALLOUT_C1} state={c1State} visible={c1Visible} />
        <CalloutSlot callout={CALLOUT_C2} state={c2State} visible={c2Visible} />
      </div>

      {/* resumed banner */}
      <div
        className={`pointer-events-none absolute left-1/2 top-28 -translate-x-1/2 transition-all duration-700 ${
          isResumed ? "opacity-100 translate-y-0" : "-translate-y-4 opacity-0"
        }`}
      >
        <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 px-10 py-4 text-center shadow-[0_0_60px_rgba(52,211,153,0.45)]">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-300">
            crash survived
          </p>
          <p className="font-mono text-sm text-emerald-100">{variant.resumed.statChip}</p>
        </div>
      </div>

      {/* bottom row */}
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
          ⚠ {variant.kill.buttonLabel}
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
      className={`transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <AgentCallout callout={callout} state={state} />
    </div>
  );
}

// --- visual primitives --------------------------------------------------

function Tile({
  label,
  value,
  critical,
  children,
}: {
  label: string;
  value: string;
  critical: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-zinc-950 p-6 transition-colors duration-500 ${
        critical ? "border-red-500/40" : "border-white/10"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          {label}
        </span>
        <span
          className={`font-mono text-3xl font-semibold tabular-nums transition-colors duration-500 ${
            critical ? "text-red-200" : "text-white"
          }`}
        >
          {value}
        </span>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 items-center justify-center">{children}</div>
    </div>
  );
}

function Sparkline({ points }: { points: number }) {
  const w = 480;
  const h = 160;
  const pad = 8;
  const n = P99_SERIES.length;
  const visible = P99_SERIES.slice(0, Math.max(points, 1));
  const path = visible
    .map((v, i) => {
      const x = pad + (i / (n - 1)) * (w - pad * 2);
      const y = h - pad - (Math.min(v, P99_MAX) / P99_MAX) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const thresholdY = h - pad - (P99_THRESHOLD / P99_MAX) * (h - pad * 2);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full">
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="rgba(255,255,255,0.08)" />
      <line
        x1={pad}
        y1={thresholdY}
        x2={w - pad}
        y2={thresholdY}
        stroke="rgba(248,113,113,0.4)"
        strokeDasharray="4 4"
      />
      <text x={w - pad - 4} y={thresholdY - 4} textAnchor="end" className="fill-red-400/70 font-mono text-[10px]">
        1200ms
      </text>
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`transition-colors duration-500 ${
          visible[visible.length - 1] >= P99_THRESHOLD ? "text-red-400" : "text-sky-400"
        }`}
      />
      {visible.length > 0 && (
        <circle
          cx={pad + ((visible.length - 1) / (n - 1)) * (w - pad * 2)}
          cy={h - pad - (Math.min(visible[visible.length - 1], P99_MAX) / P99_MAX) * (h - pad * 2)}
          r="4"
          className={`${visible[visible.length - 1] >= P99_THRESHOLD ? "fill-red-400" : "fill-sky-400"} ${
            points > 0 ? "animate-pulse" : ""
          }`}
        />
      )}
    </svg>
  );
}

function Gauge({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1);
  const r = 60;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const color = pct < 0.3 ? "text-emerald-400" : pct < 0.6 ? "text-amber-400" : "text-red-400";
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full">
      <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
      <circle
        cx="80"
        cy="80"
        r={r}
        fill="none"
        strokeWidth="12"
        strokeLinecap="round"
        transform="rotate(-90 80 80)"
        strokeDasharray={`${dash} ${c}`}
        className={`transition-all duration-500 ${color}`}
        stroke="currentColor"
      />
    </svg>
  );
}

function BurnDown({ value }: { value: number }) {
  const w = 480;
  const h = 160;
  const pad = 8;
  const pct = value / 100;
  const color = value > 70 ? "text-emerald-400" : value > 40 ? "text-amber-400" : "text-red-400";
  const topY = pad;
  const curY = pad + (1 - pct) * (h - pad * 2);
  const path = `M${pad},${topY} L${w - pad},${curY} L${w - pad},${h - pad} L${pad},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full">
      <path d={path} className={`${color} opacity-30 transition-all duration-700`} fill="currentColor" />
      <line
        x1={pad}
        y1={topY}
        x2={w - pad}
        y2={curY}
        stroke="currentColor"
        strokeWidth="2"
        className={`transition-colors duration-500 ${color}`}
      />
    </svg>
  );
}

function SirenIcon({ tone }: { tone: "zinc" | "amber" | "red" | "emerald" }) {
  const fill =
    tone === "red"
      ? "fill-red-500 text-red-500 animate-pulse"
      : tone === "amber"
        ? "fill-amber-400 text-amber-400"
        : tone === "emerald"
          ? "fill-emerald-400 text-emerald-400"
          : "fill-zinc-600 text-zinc-600";
  return (
    <div
      className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black transition-colors duration-500 ${
        tone === "red" ? "shadow-[0_0_30px_rgba(248,113,113,0.4)]" : ""
      }`}
    >
      <svg viewBox="0 0 24 24" className={`h-7 w-7 ${fill}`} strokeWidth="2" stroke="currentColor">
        <path d="M12 3a5 5 0 0 0-5 5v3H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-2V8a5 5 0 0 0-5-5Z" fill="currentColor" />
        <line x1="12" y1="16" x2="12" y2="21" />
        <line x1="7" y1="17" x2="5" y2="21" />
        <line x1="17" y1="17" x2="19" y2="21" />
      </svg>
    </div>
  );
}
