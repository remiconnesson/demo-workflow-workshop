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
// Variant 16 · Metronome
// A huge brass pendulum ticks at ~1Hz. Each frame swings through a charge
// card. On the fraud frame the pendulum FREEZES mid-swing at +25°, a red
// inverted triangle alert appears above the bob. Kill turns the pendulum
// dark red. Replay trembles then resumes swinging with a "cached beats" chip
// briefly shown. Resume: emerald "94 days · 0 missed beats" banner.
// ---------------------------------------------------------------------------

const TICK_MS = 1_000;          // full swing cycle
const FROZEN_ANGLE_DEG = 25;    // pendulum halts here on fraud

export function MetronomeDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 7_500,
    crashHoldMs: 2_400,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  // Frame index drives which charge is under the bob (deterministic sine).
  const fi = Math.floor(elapsed / TICK_MS);
  const chargeIdx = Math.min(fi, CHARGES.length - 1);
  const currentCharge = CHARGES[chargeIdx];

  const scanned = 42_804_192 + Math.floor(elapsed / 700) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  const frozenAtFraud =
    m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;

  // Angle in degrees. Live: sin wave, ±30°. Frozen: +25°.
  // Replay: small tremble around the frozen angle via additional sine.
  const liveAngle = Math.sin((elapsed / TICK_MS) * Math.PI * 2) * 30;
  let angle: number;
  if (m.isCrashed) angle = FROZEN_ANGLE_DEG;
  else if (m.isReplaying)
    angle = FROZEN_ANGLE_DEG + Math.sin(elapsed / 60) * 1.2;
  else if (m.isArmed) angle = FROZEN_ANGLE_DEG;
  else if (m.isResumed) angle = liveAngle;
  else angle = liveAngle;

  // Bob color
  const bobFill = m.isCrashed
    ? "#7f1d1d"
    : frozenAtFraud
      ? "#ef4444"
      : m.isResumed
        ? "#34d399"
        : "#e5e7eb";

  const armStroke = m.isCrashed
    ? "#450a0a"
    : frozenAtFraud
      ? "#b91c1c"
      : m.isResumed
        ? "#10b981"
        : "#d1d5db";

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    out.push({ kind: "RUN", msg: "metronome.tick(period: 1s)" });
    if (frozenAtFraud) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "pendulum halted · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying cached beats" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 missed beats" });
    }
    return out;
  }, [m.phase, m.isCrashed, m.isReplaying, m.isResumed, frozenAtFraud]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Metronome · 1Hz pulse"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black">
        {/* Corner readouts */}
        <div className="pointer-events-none absolute top-6 left-8 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            cadence
          </span>
          <span
            className={`font-mono text-xl tabular-nums transition-colors duration-300 ${
              m.isCrashed
                ? "text-red-300"
                : frozenAtFraud
                  ? "text-red-300"
                  : m.isResumed
                    ? "text-emerald-300"
                    : "text-zinc-200"
            }`}
          >
            {m.isCrashed
              ? "SILENCED"
              : frozenAtFraud
                ? `LOCKED · +${FROZEN_ANGLE_DEG}°`
                : m.active
                  ? `60 bpm · ${Math.round(angle)}°`
                  : "60 bpm"}
          </span>
        </div>

        <div className="pointer-events-none absolute top-6 right-8 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            current tick
          </span>
          <span className="font-mono text-xl tabular-nums text-zinc-200">
            {m.active ? `beat ${(chargeIdx + 1).toString().padStart(2, "0")}/11` : "—"}
          </span>
        </div>

        {/* Metronome SVG */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className="h-[min(88%,720px)] w-[min(88%,720px)]"
          >
            <defs>
              <linearGradient id="metro-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1f1f1f" />
                <stop offset="100%" stopColor="#0a0a0a" />
              </linearGradient>
              <radialGradient id="bob-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={bobFill} stopOpacity="1" />
                <stop offset="100%" stopColor={bobFill} stopOpacity="0.55" />
              </radialGradient>
            </defs>

            {/* Base trapezoid */}
            <path
              d="M 28 90 L 72 90 L 62 24 L 38 24 Z"
              fill="url(#metro-body)"
              stroke="rgb(255 255 255 / 0.15)"
              strokeWidth="0.3"
            />

            {/* Graduation ticks on frame */}
            {[-30, -20, -10, 0, 10, 20, 30].map((g) => {
              const rad = (g * Math.PI) / 180;
              const x1 = 50 + Math.sin(rad) * 26;
              const y1 = 90 - Math.cos(rad) * 26;
              const x2 = 50 + Math.sin(rad) * 30;
              const y2 = 90 - Math.cos(rad) * 30;
              return (
                <line
                  key={g}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgb(255 255 255 / 0.22)"
                  strokeWidth="0.22"
                />
              );
            })}

            {/* Frozen-angle marker (audience tell) */}
            {frozenAtFraud && (
              <line
                x1={50 + Math.sin((FROZEN_ANGLE_DEG * Math.PI) / 180) * 26}
                y1={90 - Math.cos((FROZEN_ANGLE_DEG * Math.PI) / 180) * 26}
                x2={50 + Math.sin((FROZEN_ANGLE_DEG * Math.PI) / 180) * 34}
                y2={90 - Math.cos((FROZEN_ANGLE_DEG * Math.PI) / 180) * 34}
                stroke="rgb(248 113 113)"
                strokeWidth="0.45"
                opacity="0.7"
              />
            )}

            {/* Pendulum rotating group — origin near base */}
            <g
              transform={`rotate(${angle} 50 90)`}
              style={{
                transition:
                  m.isArmed || m.isCrashed ? "transform 500ms ease-out" : "none",
              }}
            >
              {/* Arm */}
              <line
                x1="50"
                y1="90"
                x2="50"
                y2="22"
                stroke={armStroke}
                strokeWidth="0.9"
                strokeLinecap="round"
                style={{
                  filter: frozenAtFraud
                    ? "drop-shadow(0 0 3px rgba(248,113,113,0.55))"
                    : m.isResumed
                      ? "drop-shadow(0 0 3px rgba(52,211,153,0.45))"
                      : "none",
                  transition: "stroke 400ms ease, filter 400ms ease",
                }}
              />
              {/* Bob */}
              <circle
                cx="50"
                cy="32"
                r="5.5"
                fill="url(#bob-grad)"
                stroke={armStroke}
                strokeWidth="0.4"
                style={{
                  filter: frozenAtFraud
                    ? "drop-shadow(0 0 8px rgba(248,113,113,0.65))"
                    : m.isResumed
                      ? "drop-shadow(0 0 8px rgba(52,211,153,0.55))"
                      : "drop-shadow(0 0 3px rgba(255,255,255,0.25))",
                  transition: "fill 400ms ease, filter 400ms ease",
                }}
              />
              {/* Alert triangle above bob when frozen */}
              <g
                style={{
                  opacity: frozenAtFraud ? 1 : 0,
                  transition: "opacity 400ms ease",
                }}
              >
                <polygon
                  points="50,16 46.5,22 53.5,22"
                  fill="rgb(248 113 113)"
                  transform="translate(0 4) rotate(180 50 19)"
                  style={{
                    filter: "drop-shadow(0 0 3px rgba(248,113,113,0.8))",
                  }}
                />
                <text
                  x="50"
                  y="22"
                  textAnchor="middle"
                  fontSize="3.5"
                  fill="white"
                  fontFamily="ui-monospace, monospace"
                  fontWeight="700"
                >
                  !
                </text>
              </g>
            </g>

            {/* Pivot dot */}
            <circle cx="50" cy="90" r="1.4" fill="#e5e7eb" opacity="0.9" />
          </svg>
        </div>

        {/* Current charge chip */}
        <div
          className={`pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${
            m.active && !m.isCrashed ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className={`rounded-xl border bg-black/80 px-5 py-2 font-mono text-sm tabular-nums ${
              frozenAtFraud
                ? "border-red-500/60 text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.4)]"
                : "border-white/10 text-zinc-300"
            }`}
          >
            {currentCharge
              ? `${currentCharge.card} · ${currentCharge.merchant} · ${currentCharge.amount}`
              : "…"}
          </div>
        </div>

        {/* Cached beats chip — visible during replay */}
        <div
          className={`pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${
            m.isReplaying ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="rounded-full border border-sky-500/60 bg-black/80 px-5 py-2 font-mono text-sm uppercase tracking-[0.3em] text-sky-200">
            cached beats · 13,249 stored
          </span>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Pendulum stopped · process killed"
          footer="Event log intact · beats cached"
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
        headline="94 days · 0 missed beats"
        stat={`${FRAUD_CARD} frozen · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
