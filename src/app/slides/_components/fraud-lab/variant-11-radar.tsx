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
// Variant 11 · Radar ping (submarine)
// Full-bleed circular radar with phosphor-green sweep rotating once every 3s.
// Cleared charges appear as small pips around the field as the sweep crosses
// them. On fraud, the sweep reveals an outsized red blip — next pass doubles
// it — then the sweep LOCKS, a TARGET LOCK bracket appears, and a red ring
// ripples outward. Crash freezes the sweep. Replay reignites the glow. Resume
// leaves the lock and the red contact permanent.
// ---------------------------------------------------------------------------

const FRAUD_IDX = CHARGES.length - 1;
const SWEEP_PERIOD_MS = 3_000;

// Radar positions in polar coords (angle deg from 12 o'clock CW, radius 0..1)
// Fraud position corresponds to DAL-ish bearing (~225 deg, far out on rim).
const PIPS: { angle: number; radius: number }[] = [
  { angle: 24,  radius: 0.44 },
  { angle: 62,  radius: 0.58 },
  { angle: 102, radius: 0.32 },
  { angle: 148, radius: 0.62 },
  { angle: 188, radius: 0.48 },
  { angle: 40,  radius: 0.72 },
  { angle: 248, radius: 0.40 },
  { angle: 298, radius: 0.66 },
  { angle: 340, radius: 0.52 },
  { angle: 80,  radius: 0.28 },
  // fraud — far rim, SW bearing
  { angle: 225, radius: 0.84 },
];

function polar(angle: number, radius: number): { x: number; y: number } {
  // 0deg = up; convert to standard
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: 50 + Math.cos(rad) * radius * 46,
    y: 50 + Math.sin(rad) * radius * 46,
  };
}

export function RadarDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_000,
    crashHoldMs: 2_200,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const scanned = 42_804_192 + Math.floor(elapsed / 700) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  // Sweep angle: rotates 360° every SWEEP_PERIOD_MS.
  // Locks when armed/crashed/replaying/resumed (so the beam sits on the fraud).
  const lockedAngle = PIPS[FRAUD_IDX].angle;
  const sweepLocked =
    m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;
  const liveAngle = (elapsed / SWEEP_PERIOD_MS) * 360;
  const sweepAngle = sweepLocked ? lockedAngle : liveAngle;

  // Which cleared pips have been revealed by this sweep pass
  const fullTurn = liveAngle % 360;
  const revealed = (i: number): boolean => {
    if (!m.active) return false;
    if (sweepLocked) return true;
    return fullTurn >= PIPS[i].angle;
  };

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    out.push({ kind: "RUN", msg: `sonarSweep(period: 3s)` });
    if (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "passive sonar · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying contacts" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, m.isArmed, m.isCrashed, m.isReplaying, m.isResumed]);

  const fraudPos = polar(PIPS[FRAUD_IDX].angle, PIPS[FRAUD_IDX].radius);
  const phosphorOn = !m.isCrashed;

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Radar · Sonar ping"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black">
        {/* Corner readout */}
        <div className="pointer-events-none absolute top-6 left-8 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            sentinel
          </span>
          <span
            className={`font-mono text-xl tabular-nums transition-colors duration-300 ${
              m.isCrashed ? "text-red-300" : "text-emerald-300"
            }`}
          >
            DEPTH ∞ · 94d SUBMERGED
          </span>
        </div>

        <div className="pointer-events-none absolute top-6 right-8 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            bearing
          </span>
          <span
            className={`font-mono text-xl tabular-nums transition-colors duration-300 ${
              sweepLocked ? "text-red-300" : "text-emerald-300/80"
            }`}
          >
            {sweepLocked ? `LOCK · ${Math.round(lockedAngle)}°` : `SWEEP · ${Math.round(fullTurn)}°`}
          </span>
        </div>

        {/* Radar circle */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className={`h-[min(88%,720px)] w-[min(88%,720px)] transition-opacity duration-500 ${
              phosphorOn ? "opacity-100" : "opacity-40"
            }`}
            style={{
              filter: phosphorOn
                ? "drop-shadow(0 0 12px rgba(74,222,128,0.35))"
                : "none",
            }}
          >
            <defs>
              <radialGradient id="radar-field" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(22,101,52,0.35)" />
                <stop offset="100%" stopColor="rgba(10,15,10,0.9)" />
              </radialGradient>
              <linearGradient id="sweep-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(74,222,128,0.0)" />
                <stop offset="75%" stopColor="rgba(74,222,128,0.25)" />
                <stop offset="100%" stopColor="rgba(74,222,128,0.85)" />
              </linearGradient>
              <linearGradient id="sweep-grad-locked" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(248,113,113,0.0)" />
                <stop offset="75%" stopColor="rgba(248,113,113,0.3)" />
                <stop offset="100%" stopColor="rgba(248,113,113,0.9)" />
              </linearGradient>
            </defs>

            {/* Field */}
            <circle cx="50" cy="50" r="46" fill="url(#radar-field)" stroke="rgb(74,222,128)" strokeOpacity="0.4" strokeWidth="0.3" />

            {/* Concentric rings */}
            {[12, 24, 36].map((r) => (
              <circle
                key={r}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="rgb(74,222,128)"
                strokeOpacity="0.22"
                strokeWidth="0.2"
              />
            ))}

            {/* Crosshairs */}
            <line x1="4" y1="50" x2="96" y2="50" stroke="rgb(74,222,128)" strokeOpacity="0.18" strokeWidth="0.2" />
            <line x1="50" y1="4" x2="50" y2="96" stroke="rgb(74,222,128)" strokeOpacity="0.18" strokeWidth="0.2" />

            {/* Compass labels */}
            <text x="50" y="7.5" textAnchor="middle" fontSize="3" fill="rgb(134,239,172)" fontFamily="ui-monospace, monospace">N</text>
            <text x="94" y="51.5" textAnchor="middle" fontSize="3" fill="rgb(134,239,172)" fontFamily="ui-monospace, monospace">E</text>
            <text x="50" y="96" textAnchor="middle" fontSize="3" fill="rgb(134,239,172)" fontFamily="ui-monospace, monospace">S</text>
            <text x="6" y="51.5" textAnchor="middle" fontSize="3" fill="rgb(134,239,172)" fontFamily="ui-monospace, monospace">W</text>

            {/* Cleared pips */}
            {PIPS.map((p, i) => {
              if (i === FRAUD_IDX) return null;
              const pos = polar(p.angle, p.radius);
              const show = revealed(i);
              // Fade pips as sweep moves past them (simple trailing fade).
              return (
                <circle
                  key={`pip-${i}`}
                  cx={pos.x}
                  cy={pos.y}
                  r={0.8}
                  fill="rgb(134,239,172)"
                  opacity={show ? 0.75 : 0}
                  style={{
                    transition: "opacity 700ms ease",
                    filter: "drop-shadow(0 0 1.2px rgba(74,222,128,0.9))",
                  }}
                />
              );
            })}

            {/* Fraud blip — grows from single → doubled once sweep exposes it */}
            {(m.active) && (
              <g
                opacity={
                  fullTurn >= PIPS[FRAUD_IDX].angle || sweepLocked ? 1 : 0
                }
                style={{ transition: "opacity 400ms ease" }}
              >
                {/* expanding ripple rings */}
                {sweepLocked && (
                  <>
                    <circle
                      cx={fraudPos.x}
                      cy={fraudPos.y}
                      r={3}
                      fill="none"
                      stroke="rgb(248,113,113)"
                      strokeOpacity="0.6"
                      strokeWidth="0.25"
                    >
                      <animate attributeName="r" from="3" to="18" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" from="0.7" to="0" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle
                      cx={fraudPos.x}
                      cy={fraudPos.y}
                      r={3}
                      fill="none"
                      stroke="rgb(248,113,113)"
                      strokeOpacity="0.5"
                      strokeWidth="0.2"
                    >
                      <animate attributeName="r" from="3" to="14" dur="1.6s" begin="0.5s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" from="0.7" to="0" dur="1.6s" begin="0.5s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}

                {/* outer glow */}
                <circle
                  cx={fraudPos.x}
                  cy={fraudPos.y}
                  r={sweepLocked ? 3.2 : 2}
                  fill="rgb(248,113,113)"
                  opacity={0.25}
                  style={{ transition: "r 400ms ease" }}
                />
                {/* red diamond when locked, else dot */}
                {sweepLocked ? (
                  <g
                    transform={`translate(${fraudPos.x} ${fraudPos.y}) rotate(45)`}
                    style={{ filter: "drop-shadow(0 0 2px rgba(248,113,113,0.9))" }}
                  >
                    <rect x="-1.6" y="-1.6" width="3.2" height="3.2" fill="rgb(248,113,113)" />
                  </g>
                ) : (
                  <circle
                    cx={fraudPos.x}
                    cy={fraudPos.y}
                    r={1.1}
                    fill="rgb(248,113,113)"
                    style={{ filter: "drop-shadow(0 0 1.6px rgba(248,113,113,0.9))" }}
                  />
                )}
              </g>
            )}

            {/* Sweep beam — wedge from center outward rotating */}
            <g
              transform={`rotate(${sweepAngle} 50 50)`}
              style={{
                transition: sweepLocked ? "transform 500ms ease-out" : "none",
                opacity: m.active ? (m.isCrashed ? 0.15 : 1) : 0,
              }}
            >
              <path
                d="M 50 50 L 50 4 A 46 46 0 0 1 82 16 Z"
                fill={sweepLocked ? "url(#sweep-grad-locked)" : "url(#sweep-grad)"}
                opacity={0.9}
              />
              <line
                x1="50"
                y1="50"
                x2="50"
                y2="4"
                stroke={sweepLocked ? "rgb(248,113,113)" : "rgb(74,222,128)"}
                strokeWidth="0.35"
                opacity="0.95"
              />
            </g>

            {/* Target lock bracket on fraud */}
            {sweepLocked && (
              <g
                transform={`translate(${fraudPos.x} ${fraudPos.y})`}
                style={{ opacity: 1, transition: "opacity 400ms ease" }}
              >
                {/* four corner brackets */}
                {[
                  [-6, -6, 1, 1],
                  [6, -6, -1, 1],
                  [-6, 6, 1, -1],
                  [6, 6, -1, -1],
                ].map(([x, y, dx, dy], i) => (
                  <g key={i}>
                    <line
                      x1={x}
                      y1={y}
                      x2={x + dx * 2.5}
                      y2={y}
                      stroke="rgb(248,113,113)"
                      strokeWidth="0.35"
                    />
                    <line
                      x1={x}
                      y1={y}
                      x2={x}
                      y2={y + dy * 2.5}
                      stroke="rgb(248,113,113)"
                      strokeWidth="0.35"
                    />
                  </g>
                ))}
              </g>
            )}
          </svg>
        </div>

        {/* Contact label */}
        <div
          className={`pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 text-center transition-opacity duration-500 ${
            sweepLocked ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="rounded-md border border-red-500/50 bg-black/80 px-4 py-1.5 font-mono text-sm text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.4)]">
            TARGET LOCK · {FRAUD_CARD.replace("•••• ", "")} · {FRAUD_MERCHANT.toUpperCase()}
          </div>
        </div>

        {/* Passive sonar chip (crash) */}
        <div
          className={`pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${
            m.isCrashed ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="rounded-full border border-red-500/60 bg-black/80 px-5 py-2 font-mono text-sm uppercase tracking-[0.3em] text-red-300">
            passive sonar only · contacts stored
          </span>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Sonar silent · process killed"
          footer="Event log intact · contacts cached"
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
