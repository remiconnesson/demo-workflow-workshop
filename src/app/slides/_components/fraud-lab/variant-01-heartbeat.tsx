"use client";

import { useMemo } from "react";
import { AgentDebugDrawer, type DebugEvent } from "../agent-debug-drawer";
import {
  CHARGES,
  FRAUD_CARD,
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
// Variant 01 · Heartbeat
// Hospital-monitor ECG line. Each charge scored is a green pulse. The fraud
// charge is a tall red spike. Kill → asystole flatline. Replay → white
// sweep redraws from cache. Resume → rhythm returns with the red spike
// committed.
// ---------------------------------------------------------------------------

// Viewbox is wide so the signal feels like a scope sweeping across a wall.
const VB_W = 1600;
const VB_H = 260;
const BASELINE = VB_H / 2;
const PULSE_SPACING = 140;           // px between heartbeat blips
const PULSE_DURATION_MS = 900;       // cadence
const FRAUD_SPIKE_AT = CHARGES.length - 1;

type Pulse = {
  x: number;
  index: number;
  isFraud: boolean;
  committed: boolean; // red spike persists post-resume
};

// Build a repeating PQRST-ish pulse around an anchor x.
function pulsePath(anchorX: number, tall = false, inverted = false): string {
  const dir = inverted ? -1 : 1;
  const peak = tall ? 90 : 38;
  const q = tall ? 18 : 10;
  const s = tall ? 22 : 12;
  return [
    `M ${anchorX - 40} ${BASELINE}`,
    `L ${anchorX - 14} ${BASELINE}`,
    `L ${anchorX - 8} ${BASELINE + dir * q}`,
    `L ${anchorX} ${BASELINE - dir * peak}`,
    `L ${anchorX + 8} ${BASELINE + dir * s}`,
    `L ${anchorX + 14} ${BASELINE}`,
    `L ${anchorX + 40} ${BASELINE}`,
  ].join(" ");
}

export function HeartbeatDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_000,
    crashHoldMs: 2_200,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  // Tick count across the whole sweep
  const ticks = Math.floor(elapsed / PULSE_DURATION_MS);
  const scanned = 42_804_192 + Math.min(ticks, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  // Signal offset — drifts right-to-left like a real scope.
  // When armed/crashed, the sweep pauses at the fraud spike.
  const pauseSweep = m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;
  const sweepOffset = pauseSweep
    ? -(FRAUD_SPIKE_AT + 0.5) * PULSE_SPACING + VB_W * 0.45
    : -((elapsed / PULSE_DURATION_MS) * PULSE_SPACING) + VB_W * 0.9;

  // Build the visible pulse list.
  const pulses: Pulse[] = useMemo(() => {
    const list: Pulse[] = [];
    for (let i = 0; i < CHARGES.length; i++) {
      list.push({
        x: i * PULSE_SPACING,
        index: i,
        isFraud: i === FRAUD_SPIKE_AT,
        committed: m.isResumed && i === FRAUD_SPIKE_AT,
      });
    }
    return list;
  }, [m.isResumed]);

  // Replay sweep: white vertical line travels L→R across the trace.
  const replayPct = m.isReplaying
    ? Math.min(100, (elapsed % 1800) / 1800 * 100)
    : 0;

  // ECG flatline y — animates toward BASELINE under crash.
  const flatline = m.isCrashed;

  const ticksUntilFraud = Math.min(ticks, FRAUD_SPIKE_AT);
  const currentCharge = CHARGES[Math.min(ticks, CHARGES.length - 1)];

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    if (ticksUntilFraud > 0) {
      out.push({ kind: "RUN", msg: `scoreRisk(batch: ${ticksUntilFraud} cleared)` });
    }
    if (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "asystole · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying ECG log" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, ticksUntilFraud, m.isArmed, m.isCrashed, m.isReplaying, m.isResumed]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Heartbeat · ECG"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        {/* scope labels */}
        <div className="pointer-events-none absolute top-6 left-8 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            lead II · charge rhythm
          </span>
          <span
            className={`font-mono text-3xl tabular-nums transition-colors duration-300 ${
              flatline ? "text-red-300" : m.isResumed ? "text-emerald-200" : "text-emerald-300"
            }`}
          >
            {flatline ? "ASYSTOLE" : m.isArmed ? "VF · 0.93" : `${70 + (ticks % 4)} bpm`}
          </span>
        </div>
        <div className="pointer-events-none absolute top-6 right-8 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            elapsed
          </span>
          <span className="font-mono text-3xl tabular-nums text-zinc-300">
            {Math.floor(elapsed / 1000)
              .toString()
              .padStart(2, "0")}
            :
            {Math.floor((elapsed / 10) % 100)
              .toString()
              .padStart(2, "0")}
          </span>
        </div>

        {/* current charge readout, above the trace */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[140px] text-center">
          <div
            className={`font-mono text-lg tabular-nums transition-colors duration-300 ${
              m.isArmed || m.isCrashed || m.isReplaying || m.isResumed
                ? "text-red-300"
                : "text-emerald-300/80"
            } ${m.active ? "opacity-100" : "opacity-0"}`}
          >
            {currentCharge.time} · {currentCharge.card} · {currentCharge.merchant}
          </div>
        </div>

        {/* ECG grid background */}
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="absolute top-1/2 left-0 h-[260px] w-full -translate-y-1/2"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id="ecg-grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="rgb(34,197,94)"
                strokeOpacity="0.08"
                strokeWidth="1"
              />
            </pattern>
            <linearGradient id="ecg-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgb(34,197,94)" stopOpacity="0" />
              <stop offset="15%" stopColor="rgb(34,197,94)" stopOpacity="0.4" />
              <stop offset="90%" stopColor="rgb(34,197,94)" stopOpacity="1" />
              <stop offset="100%" stopColor="rgb(34,197,94)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <rect width={VB_W} height={VB_H} fill="url(#ecg-grid)" />

          {/* baseline glow */}
          <line
            x1="0"
            x2={VB_W}
            y1={BASELINE}
            y2={BASELINE}
            stroke="rgb(34,197,94)"
            strokeOpacity="0.18"
            strokeWidth="1"
          />

          {/* Live trace — shifted by sweepOffset */}
          <g
            transform={`translate(${sweepOffset}, 0)`}
            style={{ transition: pauseSweep ? "transform 600ms ease-out" : "none" }}
          >
            {pulses.map((p) => {
              const reached = ticks >= p.index || pauseSweep;
              if (!reached && !m.isResumed) return null;
              const red = p.isFraud && (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed);
              const dimmed = flatline && !p.isFraud;
              return (
                <path
                  key={p.index}
                  d={pulsePath(p.x, p.isFraud && (red || m.isArmed), false)}
                  fill="none"
                  stroke={red ? "rgb(248,113,113)" : dimmed ? "rgb(113,113,122)" : "rgb(74,222,128)"}
                  strokeWidth={red ? 3.5 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    filter: red
                      ? "drop-shadow(0 0 6px rgba(248,113,113,0.9))"
                      : "drop-shadow(0 0 3px rgba(74,222,128,0.6))",
                    opacity: dimmed ? 0.35 : 1,
                    transition: "stroke 300ms ease, opacity 400ms ease",
                  }}
                />
              );
            })}
            {/* asystole line — lays over pulses during crash */}
            {flatline && (
              <line
                x1="0"
                x2={VB_W * 2}
                y1={BASELINE}
                y2={BASELINE}
                stroke="rgb(248,113,113)"
                strokeWidth="2"
                strokeDasharray="6 6"
                style={{ filter: "drop-shadow(0 0 4px rgba(248,113,113,0.7))" }}
              />
            )}
          </g>

          {/* Replay sweep */}
          <line
            x1={`${replayPct}%`}
            x2={`${replayPct}%`}
            y1="0"
            y2={VB_H}
            stroke="white"
            strokeWidth="2"
            opacity={m.isReplaying ? 0.8 : 0}
            style={{
              filter: "drop-shadow(0 0 8px rgba(255,255,255,0.8))",
              transition: "opacity 250ms ease",
            }}
          />
        </svg>

        {/* bottom pulse index markers */}
        <div className="pointer-events-none absolute bottom-6 left-0 flex w-full items-center justify-center gap-2">
          {CHARGES.map((c, i) => {
            const lit = m.active && (ticks >= i || pauseSweep);
            const isFraud = i === FRAUD_SPIKE_AT;
            const red = isFraud && (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed);
            return (
              <div
                key={i}
                className={`h-2 w-6 rounded-full transition-all duration-300 ${
                  red
                    ? "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.8)]"
                    : lit
                      ? "bg-emerald-400/70"
                      : "bg-white/10"
                }`}
                title={`${c.time} · ${c.card}`}
              />
            );
          })}
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Asystole · process killed"
          footer="Event log intact · rhythm cached"
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
        headline="Rhythm restored."
        stat={`${FRAUD_CARD} frozen · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
