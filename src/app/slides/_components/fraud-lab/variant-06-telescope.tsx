"use client";

import { useMemo } from "react";
import { AgentDebugDrawer, type DebugEvent } from "../agent-debug-drawer";
import {
  CHARGES,
  FRAUD_CARD,
  FRAUD_COUNTRY,
  FRAUD_MERCHANT,
  FRAUD_REASON,
  STARTING_LOOP,
  TopStrip,
  IdleHint,
  CrashOverlay,
  ReplayingChip,
  ResumedBanner,
  KillButton,
  usePhaseMachine,
  useElapsed,
} from "./_shared";

// ---------------------------------------------------------------------------
// Variant 06 · Telescope
// Dark starfield with a drifting reticle. Every charge is a star; the fraud
// charge appears as a red star far out on the rim. The reticle drifts lazily
// between stars during live, then SNAPS at impossible speed to the red star
// when fraud arms. Crash dims the signal ("SIGNAL LOST"); replay restores;
// resume leaves the red bracket permanently locked.
// ---------------------------------------------------------------------------

const FRAUD_IDX = CHARGES.length - 1;

// Deterministic starfield — ambient stars (decorative) + charge stars (labeled).
type Star = { x: number; y: number; r: number; twinkle: number };

const AMBIENT_STARS: Star[] = Array.from({ length: 140 }, (_, i) => {
  // Deterministic pseudo-random placement
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 43758.5453;
  return {
    x: (a - Math.floor(a)) * 100,
    y: (b - Math.floor(b)) * 100,
    r: 0.4 + ((a - Math.floor(a)) * 1.1),
    twinkle: ((b - Math.floor(b)) * 3) % 3,
  };
});

// Charge stars placed around the field — fraud star on the rim.
const CHARGE_POS: { x: number; y: number }[] = [
  { x: 22, y: 38 },
  { x: 35, y: 62 },
  { x: 48, y: 30 },
  { x: 58, y: 70 },
  { x: 42, y: 48 },
  { x: 66, y: 40 },
  { x: 30, y: 80 },
  { x: 72, y: 58 },
  { x: 55, y: 22 },
  { x: 38, y: 18 },
  { x: 88, y: 82 }, // fraud — far rim
];

// Constellation lines (faint grid)
const CONSTELLATIONS: { x1: number; y1: number; x2: number; y2: number }[] = [
  { x1: 22, y1: 38, x2: 35, y2: 62 },
  { x1: 35, y1: 62, x2: 42, y2: 48 },
  { x1: 42, y1: 48, x2: 48, y2: 30 },
  { x1: 48, y1: 30, x2: 55, y2: 22 },
  { x1: 55, y1: 22, x2: 66, y2: 40 },
  { x1: 66, y1: 40, x2: 72, y2: 58 },
  { x1: 58, y1: 70, x2: 72, y2: 58 },
];

const DRIFT_PERIOD_MS = 2_400;

export function TelescopeDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_000,
    crashHoldMs: 2_200,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  // Which charge is the reticle currently "looking at" during live drift
  const driftIdx = Math.min(
    Math.floor(elapsed / DRIFT_PERIOD_MS),
    FRAUD_IDX - 1,
  );

  const pauseToFraud =
    m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;

  // Reticle position (percent). Snaps to fraud star when armed.
  const targetIdx = pauseToFraud ? FRAUD_IDX : driftIdx;
  const target = CHARGE_POS[targetIdx];

  // Visible stars progressive reveal
  const visibleCount = m.active ? Math.min(driftIdx + 1, FRAUD_IDX) : 0;

  const scanned = 42_804_192 + Math.min(driftIdx, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  // Reticle snap transition — fast when snapping to fraud, lazy during drift
  const reticleTransition = pauseToFraud
    ? "left 120ms cubic-bezier(0.2, 0.85, 0.3, 1), top 120ms cubic-bezier(0.2, 0.85, 0.3, 1), transform 400ms ease"
    : "left 900ms ease-in-out, top 900ms ease-in-out, transform 400ms ease";

  // Days counter
  const days = (94.02 + (elapsed / 1000) * 0.0001).toFixed(2);

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    if (driftIdx > 0) {
      out.push({ kind: "RUN", msg: `scoreRisk(batch: ${driftIdx} cleared)` });
    }
    if (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "WAI", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "signal lost · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying event log" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, driftIdx, m.isArmed, m.isCrashed, m.isReplaying, m.isResumed]);

  const redLocked =
    m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Telescope · Sentinel-1"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black">
        {/* Starfield */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${
            m.isCrashed ? "opacity-20" : "opacity-100"
          }`}
        >
          <defs>
            <radialGradient id="tele-star" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,1)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <radialGradient id="tele-red-star" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(248,113,113,1)" />
              <stop offset="100%" stopColor="rgba(248,113,113,0)" />
            </radialGradient>
          </defs>

          {/* ambient stars */}
          {AMBIENT_STARS.map((s, i) => (
            <circle
              key={`a-${i}`}
              cx={s.x}
              cy={s.y}
              r={s.r * 0.22}
              fill="white"
              opacity={0.3 + s.twinkle * 0.15}
            />
          ))}

          {/* constellation lines (faint) */}
          {CONSTELLATIONS.map((c, i) => (
            <line
              key={`c-${i}`}
              x1={c.x1}
              y1={c.y1}
              x2={c.x2}
              y2={c.y2}
              stroke="white"
              strokeOpacity="0.06"
              strokeWidth="0.12"
            />
          ))}

          {/* charge stars — bright dots that pop in */}
          {CHARGE_POS.map((p, i) => {
            if (i === FRAUD_IDX) return null;
            const visible = i < visibleCount || pauseToFraud;
            return (
              <g key={`ch-${i}`} opacity={visible ? 1 : 0} style={{ transition: "opacity 400ms ease" }}>
                <circle cx={p.x} cy={p.y} r={1.6} fill="url(#tele-star)" />
                <circle cx={p.x} cy={p.y} r={0.55} fill="white" />
              </g>
            );
          })}

          {/* fraud red star */}
          <g
            opacity={redLocked ? 1 : 0}
            style={{ transition: "opacity 400ms ease" }}
          >
            <circle
              cx={CHARGE_POS[FRAUD_IDX].x}
              cy={CHARGE_POS[FRAUD_IDX].y}
              r={3}
              fill="url(#tele-red-star)"
              style={{
                filter: "drop-shadow(0 0 3px rgba(248,113,113,0.9))",
              }}
            />
            <circle
              cx={CHARGE_POS[FRAUD_IDX].x}
              cy={CHARGE_POS[FRAUD_IDX].y}
              r={0.9}
              fill="rgb(248,113,113)"
            />
          </g>
        </svg>

        {/* Corner readout — SENTINEL-1 · days observing */}
        <div className="pointer-events-none absolute top-6 left-8 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            sentinel-1
          </span>
          <span
            className={`font-mono text-2xl tabular-nums transition-colors duration-300 ${
              m.isCrashed ? "text-red-300" : "text-zinc-200"
            }`}
          >
            {days} days observing
          </span>
        </div>

        {/* Top right status */}
        <div className="pointer-events-none absolute top-6 right-8 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            target
          </span>
          <span
            className={`font-mono text-2xl tabular-nums transition-colors duration-300 ${
              redLocked ? "text-red-300" : "text-emerald-300"
            }`}
          >
            {redLocked ? FRAUD_CARD : CHARGES[Math.min(driftIdx, FRAUD_IDX - 1)].card}
          </span>
        </div>

        {/* Reticle */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${target.x}%`,
            top: `${target.y}%`,
            transform: `translate(-50%, -50%) scale(${redLocked ? 1.6 : 1})`,
            transition: reticleTransition,
          }}
        >
          <svg
            viewBox="-60 -60 120 120"
            className={`h-32 w-32 ${redLocked ? "text-red-400" : "text-emerald-300/80"}`}
          >
            <circle cx="0" cy="0" r="44" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.9" />
            <circle cx="0" cy="0" r="28" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.7" />
            <line x1="-54" y1="0" x2="-16" y2="0" stroke="currentColor" strokeWidth="1.2" />
            <line x1="16" y1="0" x2="54" y2="0" stroke="currentColor" strokeWidth="1.2" />
            <line x1="0" y1="-54" x2="0" y2="-16" stroke="currentColor" strokeWidth="1.2" />
            <line x1="0" y1="16" x2="0" y2="54" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="0" cy="0" r="2" fill="currentColor" />
          </svg>
        </div>

        {/* Red bracket + label when locked on fraud */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${CHARGE_POS[FRAUD_IDX].x}%`,
            top: `${CHARGE_POS[FRAUD_IDX].y}%`,
            transform: "translate(-50%, -50%)",
            opacity: redLocked ? 1 : 0,
            transition: "opacity 400ms ease 180ms",
          }}
        >
          <div className="relative">
            {/* corner brackets */}
            <div className="h-28 w-28 border-2 border-red-400" style={{ clipPath: "polygon(0 0, 30% 0, 30% 6%, 6% 6%, 6% 30%, 0 30%, 0 70%, 6% 70%, 6% 94%, 30% 94%, 30% 100%, 0 100%, 0 100%, 70% 100%, 70% 94%, 94% 94%, 94% 70%, 100% 70%, 100% 30%, 94% 30%, 94% 6%, 70% 6%, 70% 0, 100% 0)" }} />
            <div className="absolute top-full left-1/2 mt-3 -translate-x-1/2 rounded-md border border-red-500/60 bg-black/80 px-3 py-1.5 font-mono text-xs whitespace-nowrap text-red-200 shadow-[0_0_20px_rgba(248,113,113,0.4)]">
              {FRAUD_MERCHANT.toUpperCase()} · {FRAUD_CARD.replace("•••• ", "")} · {CHARGES[FRAUD_IDX].amount} · {FRAUD_COUNTRY}
            </div>
          </div>
        </div>

        {/* Signal lost (crash) */}
        <div
          className={`pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${
            m.isCrashed ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="rounded-full border border-red-500/60 bg-black/70 px-5 py-2 font-mono text-sm uppercase tracking-[0.3em] text-red-300">
            signal lost
          </span>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Signal lost · process killed"
          footer="Event log intact · last fix preserved"
        />
        <ReplayingChip active={m.isReplaying} />
        <IdleHint
          eyebrow="fraud sentinel · always on"
          purpose="94 days of one loop."
          active={!m.active}
        />
      </div>

      <ResumedBanner
        active={m.isResumed}
        headline="Crash survived."
        stat={`${FRAUD_CARD} frozen · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
