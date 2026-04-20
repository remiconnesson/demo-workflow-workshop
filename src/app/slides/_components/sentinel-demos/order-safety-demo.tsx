"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentDebugDrawer, type DebugEvent } from "../agent-debug-drawer";
import type { SentinelVariant } from "../../_data/sentinel-variants";
import { useObserverRunId, useSlideRunReset } from "./_shared";
import { AgentCallout, type Callout, type CalloutState } from "./_agent-callout";

// ---------------------------------------------------------------------------
// Order-safety monitor: fleet radar + AI thread.
// The left panel is a circular SVG radar with a rotating sweep line; each
// loop tick blips in new orders at city coordinates. The right panel is the
// AI's reasoning thread. Three callouts narrate the same moment the radar
// is showing (watching → correlated → pulled), with cached sigils on replay.
// ---------------------------------------------------------------------------

type Phase = "idle" | "live" | "armed" | "crashed" | "replaying" | "resumed";

type Blip = {
  id: string;
  cx: number;       // radar coords (-1..1)
  cy: number;
  risk: "green" | "amber" | "red";
  visibleAt: number; // frame idx when blip first appears
};

const CITIES = {
  sf:  { x: -0.78, y:  0.05 },
  la:  { x: -0.68, y:  0.35 },
  sea: { x: -0.72, y: -0.48 },
  den: { x: -0.22, y:  0.12 },
  chi: { x:  0.18, y: -0.05 },
  nyc: { x:  0.68, y: -0.12 },
  mia: { x:  0.56, y:  0.58 },
  atl: { x:  0.32, y:  0.32 },
  bos: { x:  0.74, y: -0.28 },
  dal: { x: -0.02, y:  0.40 },
};

const RISKY_DRIVER_ID = "drv_042";
const RISKY_CITY = CITIES.dal;

const BLIPS: Blip[] = [
  { id: "ord_1f2a", cx: CITIES.sf.x,  cy: CITIES.sf.y,  risk: "green", visibleAt: 1 },
  { id: "ord_8c11", cx: CITIES.chi.x, cy: CITIES.chi.y, risk: "green", visibleAt: 1 },
  { id: "ord_3b04", cx: CITIES.nyc.x, cy: CITIES.nyc.y, risk: "green", visibleAt: 2 },
  { id: "ord_9d77", cx: CITIES.mia.x, cy: CITIES.mia.y, risk: "green", visibleAt: 2 },
  { id: "ord_2a18", cx: CITIES.la.x,  cy: CITIES.la.y,  risk: "amber", visibleAt: 4 },
  { id: "ord_5e33", cx: CITIES.sea.x, cy: CITIES.sea.y, risk: "green", visibleAt: 4 },
  { id: "ord_7f8e", cx: CITIES.atl.x, cy: CITIES.atl.y, risk: "green", visibleAt: 5 },
  { id: "ord_6a92", cx: CITIES.den.x, cy: CITIES.den.y, risk: "green", visibleAt: 5 },
  { id: "ord_b204", cx: CITIES.bos.x, cy: CITIES.bos.y, risk: "green", visibleAt: 6 },
  { id: "ord_rsk",  cx: RISKY_CITY.x,  cy: RISKY_CITY.y, risk: "red",   visibleAt: 4 },
];

// --- callouts ------------------------------------------------------------

const CALLOUT_C0: Callout = {
  id: "c0",
  avatar: "O",
  agentName: "Order-safety sentinel",
  timestamp: "12:48:04",
  tone: "sky",
  message:
    "Fleet reads clean: 312 orders scored this tick, all below 0.2. Watching 2,041 drivers across 10 metros.",
  citations: ["ord_1f2a", "ord_8c11", "ord_3b04"],
  verdict: "watching",
};

const CALLOUT_C1: Callout = {
  id: "c1",
  avatar: "O",
  agentName: "Order-safety sentinel",
  timestamp: "12:48:11",
  tone: "amber",
  message:
    "drv_042 just crossed anomaly 0.71 with 4 disputes in 90 minutes, radius drift across 12 miles.",
  citations: ["drv_042", "DAL"],
  verdict: "correlated",
};

const CALLOUT_C2: Callout = {
  id: "c2",
  avatar: "O",
  agentName: "Order-safety sentinel",
  timestamp: "12:48:16",
  tone: "red",
  message:
    "Pulling drv_042. Ride count frozen, support ticket opened, rider reassigned. Idempotent: already pulled pre-crash.",
  citations: ["drv_042", "#SUP-9172"],
  verdict: "pulled drv_042",
};

type Frame = {
  phase: Phase;
  blipsThrough: number;
  sweepDeg: number;
  pulled: boolean;
  haloLevel: 0 | 1 | 2 | 3;
  loopOffset: number;
  killArmed: boolean;
  delayMs: number;
  // callout state
  c0Chars: number;
  c1Chars: number;
  c2Chars: number;
  c0Cached: boolean;
  c1Cached: boolean;
};

const C0_LEN = CALLOUT_C0.message.length;
const C1_LEN = CALLOUT_C1.message.length;
const C2_LEN = CALLOUT_C2.message.length;

const FRAMES: Frame[] = [
  // 0 · idle
  { phase: "idle", blipsThrough: 0, sweepDeg: 0, pulled: false, haloLevel: 0, loopOffset: 0, killArmed: false, delayMs: 0, c0Chars: 0, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false },

  // 1 · first wave
  { phase: "live", blipsThrough: 1, sweepDeg: 45, pulled: false, haloLevel: 0, loopOffset: 1, killArmed: false, delayMs: 900, c0Chars: 0, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false },
  // 2 · second wave
  { phase: "live", blipsThrough: 2, sweepDeg: 130, pulled: false, haloLevel: 0, loopOffset: 1, killArmed: false, delayMs: 900, c0Chars: 0, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false },

  // 3 · C0 typing (watching)
  { phase: "live", blipsThrough: 3, sweepDeg: 200, pulled: false, haloLevel: 0, loopOffset: 2, killArmed: false, delayMs: 1400, c0Chars: Math.floor(C0_LEN * 0.55), c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false },
  // 4 · C0 delivered · halo level 1
  { phase: "live", blipsThrough: 4, sweepDeg: 295, pulled: false, haloLevel: 1, loopOffset: 2, killArmed: false, delayMs: 1400, c0Chars: C0_LEN, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false },

  // 5 · C1 typing (correlating)
  { phase: "live", blipsThrough: 5, sweepDeg: 20, pulled: false, haloLevel: 2, loopOffset: 3, killArmed: false, delayMs: 1400, c0Chars: C0_LEN, c1Chars: Math.floor(C1_LEN * 0.6), c2Chars: 0, c0Cached: false, c1Cached: false },
  // 6 · C1 delivered · halo level 3
  { phase: "armed", blipsThrough: 5, sweepDeg: 90, pulled: false, haloLevel: 3, loopOffset: 3, killArmed: false, delayMs: 1200, c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: false, c1Cached: false },

  // 7 · armed (killArmed, 12s)
  { phase: "armed", blipsThrough: 6, sweepDeg: 160, pulled: false, haloLevel: 3, loopOffset: 3, killArmed: true, delayMs: 12000, c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: false, c1Cached: false },

  // 8 · CRASH: sweep freeze
  { phase: "crashed", blipsThrough: 6, sweepDeg: -1, pulled: false, haloLevel: 3, loopOffset: 3, killArmed: false, delayMs: 2400, c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: false, c1Cached: false },

  // 9 · replaying: C0/C1 cached
  { phase: "replaying", blipsThrough: 6, sweepDeg: -1, pulled: false, haloLevel: 3, loopOffset: 3, killArmed: false, delayMs: 1800, c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: true, c1Cached: true },

  // 10 · resumed · C2 typing (pull)
  { phase: "resumed", blipsThrough: 6, sweepDeg: 60, pulled: true, haloLevel: 3, loopOffset: 3, killArmed: false, delayMs: 1400, c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: Math.floor(C2_LEN * 0.55), c0Cached: true, c1Cached: true },

  // 11 · resumed · C2 delivered
  { phase: "resumed", blipsThrough: 6, sweepDeg: 120, pulled: true, haloLevel: 3, loopOffset: 3, killArmed: false, delayMs: 0, c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: C2_LEN, c0Cached: true, c1Cached: true },
];

const CRASH_FRAME = 8;

function calloutState(chars: number, cached: boolean, msgLen: number): CalloutState {
  if (cached) return { kind: "cached" };
  if (chars < msgLen) return { kind: "typing", chars };
  return { kind: "delivered" };
}

// --- component ----------------------------------------------------------

export function OrderSafetyDemo({ variant }: { variant: SentinelVariant }) {
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

  const isCrashed = frame.phase === "crashed";
  const isReplaying = frame.phase === "replaying";
  const isResumed = frame.phase === "resumed";
  const loopNumber = variant.startingLoop + Math.max(0, frame.loopOffset - 1);

  const ordersBase = 6_400_000;
  const ordersSeen = ordersBase + fi * 312;
  const pulledCount = 2_041 + (isResumed ? 1 : 0);

  const c0State = calloutState(frame.c0Chars, frame.c0Cached, C0_LEN);
  const c1State = calloutState(frame.c1Chars, frame.c1Cached, C1_LEN);
  const c2State = calloutState(frame.c2Chars, false, C2_LEN);

  const c0Visible = frame.c0Chars > 0 || frame.c0Cached;
  const c1Visible = frame.c1Chars > 0 || frame.c1Cached;
  const c2Visible = frame.c2Chars > 0;

  const debugEvents: DebugEvent[] = useMemo(() => {
    const out: DebugEvent[] = [];
    if (fi === 0) return out;
    const seen = { run: false, c0: false, c1: false, arm: false, crash: false, rpl: false, c2: false };
    for (let i = 1; i <= fi; i++) {
      const fr = FRAMES[i];
      if (!fr) break;
      if (!seen.run && fr.phase === "live") {
        out.push({ kind: "RUN", msg: "scanOrders() · 312 new/tick" });
        seen.run = true;
      }
      if (!seen.c0 && fr.c0Chars >= C0_LEN) {
        out.push({ kind: "CMP", msg: "assess(batch: fleet clean · 2,041 drivers)" });
        seen.c0 = true;
      }
      if (!seen.c1 && fr.c1Chars >= C1_LEN) {
        out.push({ kind: "CMP", msg: `assess(${RISKY_DRIVER_ID}: anomaly 0.71)` });
        seen.c1 = true;
      }
      if (!seen.arm && fr.killArmed) {
        out.push({ kind: "WAI", msg: `driverRisk(${RISKY_DRIVER_ID}) · 0.88` });
        seen.arm = true;
      }
      if (!seen.crash && fr.phase === "crashed") {
        out.push({ kind: "ERR", msg: "dispatch down · queue intact" });
        seen.crash = true;
      }
      if (!seen.rpl && fr.phase === "replaying") {
        out.push({ kind: "RPL", msg: "replaying · 2 callouts cached" });
        seen.rpl = true;
      }
      if (!seen.c2 && fr.c2Chars >= C2_LEN) {
        out.push({ kind: "OK ", msg: `pullDriver(${RISKY_DRIVER_ID}) · idempotent` });
        out.push({ kind: "END", msg: "resumed · 0 duplicate pulls" });
        seen.c2 = true;
      }
    }
    return out;
  }, [fi]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      {/* top strip */}
      <div
        className={`flex items-center justify-between rounded-2xl border bg-zinc-950 px-8 py-5 transition-colors duration-500 ${
          isResumed ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-white/10"
        }`}
      >
        <div className="flex items-center gap-10">
          <div className="flex flex-col">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              {variant.agentName}
            </span>
            <span className="text-2xl font-semibold tracking-tight text-white">
              Dispatch radar · fleet safety
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Counter label="Orders watched" value={ordersSeen.toLocaleString()} />
            <Counter label="Drivers pulled" value={pulledCount.toLocaleString()} accent="red" />
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

      {/* radar + AI thread */}
      <div className="relative grid min-h-0 flex-1 grid-cols-[1fr_420px] gap-4 overflow-hidden">
        {/* radar */}
        <div className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black">
          <Radar
            sweepDeg={frame.sweepDeg}
            blips={BLIPS}
            blipsThrough={frame.blipsThrough}
            haloLevel={frame.haloLevel}
            pulled={frame.pulled}
            isCrashed={isCrashed}
            isReplaying={isReplaying}
            riskyCity={RISKY_CITY}
          />

          {/* crashed overlay (scoped to radar) */}
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-red-500/15 backdrop-blur-[1px] transition-opacity duration-300 ${
              isCrashed ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="rounded-2xl border-2 border-red-500/60 bg-black/85 px-10 py-6 text-center shadow-[0_0_80px_rgba(248,113,113,0.5)]">
              <p className="font-mono text-sm uppercase tracking-[0.3em] text-red-400">
                radar offline
              </p>
              <p className="mt-2 text-4xl font-semibold text-red-200">
                Dispatch log intact
              </p>
              <p className="mt-3 text-sm text-zinc-400">
                Last anomaly: <span className="font-mono text-red-300">{RISKY_DRIVER_ID}</span>
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
              replaying event log
            </span>
          </div>

          {/* idle hint */}
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-black/80 transition-opacity duration-500 ${
              fi === 0 ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="max-w-lg text-center">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-sky-300">
                {variant.eyebrow}
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-white">
                {variant.purposeLine}
              </p>
              <p className="mt-4 text-base text-zinc-400">
                Press <kbd className="mx-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-base">r</kbd> to watch the sweep.
              </p>
            </div>
          </div>
        </div>

        {/* AI callout thread */}
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              Agent thread
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors duration-300 ${
                isResumed
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                  : isCrashed
                    ? "border-red-500/40 bg-red-500/10 text-red-300"
                    : "border-sky-500/40 bg-sky-500/10 text-sky-300"
              }`}
            >
              {isResumed ? "resumed" : isCrashed ? "offline" : isReplaying ? "replay" : "live"}
            </span>
          </div>

          {/* three callouts, stacked */}
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden">
            <CalloutSlot callout={CALLOUT_C0} state={c0State} visible={c0Visible} />
            <CalloutSlot callout={CALLOUT_C1} state={c1State} visible={c1Visible} />
            <CalloutSlot callout={CALLOUT_C2} state={c2State} visible={c2Visible} />
          </div>
        </div>
      </div>

      {/* resumed banner */}
      <div
        className={`pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 transition-all duration-700 ${
          isResumed ? "opacity-100 translate-y-0" : "-translate-y-4 opacity-0"
        }`}
      >
        <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 px-10 py-5 text-center shadow-[0_0_60px_rgba(52,211,153,0.45)]">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-300">
            same order. a million at a time.
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-100">{variant.resumed.headline}</p>
          <p className="mt-2 font-mono text-sm text-emerald-200">{variant.resumed.statChip}</p>
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
          ⚡ {variant.kill.buttonLabel}
        </button>
      </div>
    </div>
  );
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
      className={`transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <AgentCallout callout={callout} state={state} />
    </div>
  );
}

// --- radar ---------------------------------------------------------------

function Radar({
  sweepDeg,
  blips,
  blipsThrough,
  haloLevel,
  pulled,
  isCrashed,
  isReplaying,
  riskyCity,
}: {
  sweepDeg: number;
  blips: Blip[];
  blipsThrough: number;
  haloLevel: 0 | 1 | 2 | 3;
  pulled: boolean;
  isCrashed: boolean;
  isReplaying: boolean;
  riskyCity: { x: number; y: number };
}) {
  const RADIUS = 90;
  const haloRadius = haloLevel === 0 ? 0 : haloLevel === 1 ? 6 : haloLevel === 2 ? 9 : 13;
  const haloColor = haloLevel === 3 ? "rgb(248 113 113 / 0.35)" : haloLevel === 2 ? "rgb(251 191 36 / 0.4)" : "rgb(251 191 36 / 0.25)";

  const project = (c: { x: number; y: number }) => ({
    cx: c.x * (RADIUS - 10),
    cy: c.y * (RADIUS - 10),
  });
  const risky = project(riskyCity);

  return (
    <svg
      viewBox="-100 -100 200 200"
      className="h-full max-h-[92%] w-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {[30, 55, 80, RADIUS].map((r) => (
        <circle
          key={r}
          cx="0"
          cy="0"
          r={r}
          fill="none"
          stroke="rgb(52 211 153 / 0.08)"
          strokeWidth="0.5"
        />
      ))}
      <line x1={-RADIUS} y1="0" x2={RADIUS} y2="0" stroke="rgb(52 211 153 / 0.08)" strokeWidth="0.5" />
      <line x1="0" y1={-RADIUS} x2="0" y2={RADIUS} stroke="rgb(52 211 153 / 0.08)" strokeWidth="0.5" />

      <path
        d="M -70 -10 Q -60 -30 -35 -25 Q -15 -20 10 -30 Q 45 -35 70 -20 Q 75 0 60 15 Q 40 30 20 28 Q 0 30 -20 22 Q -55 20 -70 -10 Z"
        fill="rgb(52 211 153 / 0.03)"
        stroke="rgb(52 211 153 / 0.12)"
        strokeWidth="0.6"
      />

      {sweepDeg >= 0 && (
        <g transform={`rotate(${sweepDeg})`} style={{ transition: "transform 900ms linear" }}>
          <defs>
            <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgb(52 211 153 / 0.35)" />
              <stop offset="100%" stopColor="rgb(52 211 153 / 0)" />
            </linearGradient>
          </defs>
          <path
            d={`M 0 0 L ${RADIUS} 0 A ${RADIUS} ${RADIUS} 0 0 0 ${Math.cos(-0.6) * RADIUS} ${Math.sin(-0.6) * RADIUS} Z`}
            fill="url(#sweepGrad)"
          />
          <line x1="0" y1="0" x2={RADIUS} y2="0" stroke="rgb(52 211 153 / 0.6)" strokeWidth="0.6" />
        </g>
      )}

      {isReplaying && (
        <g>
          {[12, 30, 50].map((r) => (
            <circle
              key={r}
              cx={risky.cx}
              cy={risky.cy}
              r={r}
              fill="none"
              stroke="rgb(56 189 248 / 0.35)"
              strokeWidth="0.4"
              className="animate-pulse"
            />
          ))}
        </g>
      )}

      {haloRadius > 0 && (
        <circle
          cx={risky.cx}
          cy={risky.cy}
          r={haloRadius}
          fill={haloColor}
          className={haloLevel === 3 && !isCrashed ? "animate-pulse" : ""}
        />
      )}

      {blips.map((b, i) => {
        const visible = i < blipsThrough || b.visibleAt <= blipsThrough;
        const isRisky = b.risk === "red";
        const p = project({ x: b.cx, y: b.cy });
        const color = isRisky
          ? pulled
            ? "rgb(239 68 68)"
            : "rgb(248 113 113)"
          : b.risk === "amber"
            ? "rgb(251 191 36)"
            : "rgb(52 211 153)";
        return (
          <g
            key={b.id}
            style={{
              opacity: visible ? 1 : 0,
              transition: "opacity 500ms ease",
            }}
          >
            <circle cx={p.cx} cy={p.cy} r={isRisky ? 2.2 : 1.6} fill={color} />
            {isRisky && (
              <circle
                cx={p.cx}
                cy={p.cy}
                r={4}
                fill="none"
                stroke={color}
                strokeWidth="0.4"
                opacity="0.6"
              />
            )}
          </g>
        );
      })}

      {pulled && (
        <g>
          <line
            x1={risky.cx - 5}
            y1={risky.cy - 5}
            x2={risky.cx + 5}
            y2={risky.cy + 5}
            stroke="rgb(239 68 68)"
            strokeWidth="0.8"
          />
          <line
            x1={risky.cx - 5}
            y1={risky.cy + 5}
            x2={risky.cx + 5}
            y2={risky.cy - 5}
            stroke="rgb(239 68 68)"
            strokeWidth="0.8"
          />
          <text
            x={risky.cx + 8}
            y={risky.cy + 1}
            fill="rgb(252 165 165)"
            fontSize="3.2"
            fontFamily="ui-monospace, monospace"
            fontWeight="700"
            letterSpacing="0.3"
          >
            PULLED · {RISKY_DRIVER_ID}
          </text>
        </g>
      )}
    </svg>
  );
}

// --- counter ------------------------------------------------------------

function Counter({
  label,
  value,
  accent = "white",
}: {
  label: string;
  value: string;
  accent?: "white" | "red";
}) {
  const color = accent === "red" ? "text-red-200" : "text-white";
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </span>
      <span className={`font-mono text-3xl tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
