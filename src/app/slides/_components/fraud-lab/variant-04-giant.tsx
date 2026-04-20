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
// Variant 04 · Sleeping giant
// A massive glowing orb breathes slowly at center. Charges drift in as
// particles and are absorbed. On the fraud charge, the orb opens a red
// vertical slit-pupil eye, stares, blinks once. Crash → glow extinguished.
// Replay → orb re-ignites from the center outward. Resume → eye
// reopens briefly and closes with the card committed.
// ---------------------------------------------------------------------------

const FRAUD_IDX = CHARGES.length - 1;

type Particle = {
  id: number;
  angle: number;   // origin angle from orb
  distance: number; // 0..1 (1 = far edge of canvas)
  charge: (typeof CHARGES)[number];
};

export function GiantDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_000,
    crashHoldMs: 2_200,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const ticks = Math.floor(elapsed / 700);
  const scanned = 42_804_192 + Math.min(ticks, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  // Breathing scale — scale 0.95..1.05 over 4s. Holds during crash.
  const breathPhase = (elapsed % 4000) / 4000;
  const breath = m.isCrashed
    ? 0.85
    : 0.95 + Math.sin(breathPhase * Math.PI * 2) * 0.05;

  // Particles: pre-placed per charge, distance = 1 - progress toward orb.
  const particles: Particle[] = useMemo(() => {
    const list: Particle[] = [];
    for (let i = 0; i < CHARGES.length; i++) {
      list.push({
        id: i,
        angle: (i * 137.5) % 360, // golden-angle distribution
        distance: 1,
        charge: CHARGES[i],
      });
    }
    return list;
  }, []);

  // Eye is open during armed + resumed briefly.
  const eyeOpen = m.isArmed || m.isResumed;
  // Blink once around 400ms into resumed
  const blink = m.isResumed && (elapsed % 2200) > 1000 && (elapsed % 2200) < 1200;

  // Orb state
  const orbExtinguished = m.isCrashed;
  const orbReigniting = m.isReplaying;
  const reignitePct = orbReigniting
    ? Math.min(1, (elapsed % 1800) / 1800)
    : m.isResumed
      ? 1
      : 1;

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges · orb inhales" });
    if (ticks > 0) {
      out.push({ kind: "RUN", msg: `absorb(batch: ${Math.min(ticks, FRAUD_IDX)} cleared)` });
    }
    if (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `eye opens · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "glow extinguished · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "re-igniting event log" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, ticks, m.isArmed, m.isCrashed, m.isReplaying, m.isResumed]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Sleeping giant"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        {/* horizon text */}
        <div className="pointer-events-none absolute top-8 left-1/2 -translate-x-1/2 text-center">
          <div
            className={`font-mono text-sm uppercase tracking-[0.4em] transition-colors duration-500 ${
              m.isResumed
                ? "text-emerald-300/80"
                : orbExtinguished
                  ? "text-red-300/80"
                  : "text-zinc-500"
            }`}
          >
            {orbExtinguished
              ? "0 DAYS AWAKE · EYES DARK"
              : m.isResumed
                ? "94 DAYS AWAKE · EYES CLOSED"
                : eyeOpen
                  ? "94 DAYS AWAKE · EYE OPEN"
                  : "94 DAYS AWAKE · 0 EYES CLOSED"}
          </div>
        </div>

        {/* orb canvas */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="relative"
            style={{
              width: "min(70vmin, 520px)",
              height: "min(70vmin, 520px)",
            }}
          >
            {/* outer glow halo */}
            <div
              className="absolute inset-[-20%] rounded-full transition-opacity duration-700"
              style={{
                background: orbExtinguished
                  ? "radial-gradient(circle, rgba(127,29,29,0.25) 0%, transparent 60%)"
                  : "radial-gradient(circle, rgba(56,189,248,0.4) 0%, rgba(56,189,248,0.1) 40%, transparent 70%)",
                opacity: orbExtinguished ? 0.35 : 1,
                transform: `scale(${breath})`,
                filter: "blur(24px)",
              }}
            />

            {/* orb body */}
            <svg
              viewBox="0 0 200 200"
              className="absolute inset-0 h-full w-full"
              style={{
                transform: `scale(${breath})`,
                transition: orbReigniting
                  ? "transform 1.8s ease-out"
                  : "transform 800ms ease-out",
                opacity: orbExtinguished
                  ? 0.35
                  : orbReigniting
                    ? 0.4 + reignitePct * 0.6
                    : 1,
              }}
            >
              <defs>
                <radialGradient id="orbGrad" cx="45%" cy="40%" r="55%">
                  <stop offset="0%" stopColor="rgba(224,242,254,0.95)" />
                  <stop offset="45%" stopColor="rgba(56,189,248,0.85)" />
                  <stop offset="80%" stopColor="rgba(30,64,175,0.6)" />
                  <stop offset="100%" stopColor="rgba(8,47,73,0.9)" />
                </radialGradient>
                <radialGradient id="orbDeadGrad" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="rgba(40,40,40,0.9)" />
                  <stop offset="100%" stopColor="rgba(10,10,10,0.95)" />
                </radialGradient>
                <radialGradient id="reignite" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(224,242,254,1)" />
                  <stop offset="100%" stopColor="rgba(56,189,248,0)" />
                </radialGradient>
              </defs>
              <circle
                cx="100"
                cy="100"
                r="95"
                fill={orbExtinguished ? "url(#orbDeadGrad)" : "url(#orbGrad)"}
              />
              {/* reignite expanding circle */}
              {orbReigniting && (
                <circle
                  cx="100"
                  cy="100"
                  r={95 * reignitePct}
                  fill="url(#reignite)"
                  opacity={1 - reignitePct * 0.5}
                />
              )}

              {/* eye — absolutely positioned slit */}
              <g
                style={{
                  opacity: eyeOpen && !blink ? 1 : 0,
                  transition: "opacity 250ms ease",
                }}
              >
                {/* eye socket */}
                <ellipse
                  cx="100"
                  cy="100"
                  rx="60"
                  ry={eyeOpen && !blink ? 34 : 2}
                  fill="rgba(20,6,6,0.95)"
                  style={{ transition: "ry 300ms ease" }}
                />
                {/* red iris */}
                <ellipse
                  cx="100"
                  cy="100"
                  rx="26"
                  ry="30"
                  fill="rgba(220,38,38,0.95)"
                  style={{
                    filter: "drop-shadow(0 0 12px rgba(248,113,113,0.9))",
                  }}
                />
                {/* slit pupil */}
                <rect
                  x="97.5"
                  y="76"
                  width="5"
                  height="48"
                  fill="black"
                  rx="2"
                />
                {/* highlight */}
                <circle cx="92" cy="92" r="5" fill="rgba(255,255,255,0.8)" />
              </g>

              {/* resumed ring */}
              {m.isResumed && (
                <circle
                  cx="100"
                  cy="100"
                  r="95"
                  fill="none"
                  stroke="rgb(52,211,153)"
                  strokeWidth="2"
                  strokeOpacity="0.7"
                  style={{
                    filter: "drop-shadow(0 0 10px rgba(52,211,153,0.8))",
                  }}
                />
              )}
            </svg>

            {/* inflow particles */}
            <div className="absolute inset-0">
              {particles.map((p) => {
                const arrived = ticks > p.id;
                // travelDistance: 1 (far) -> 0 (absorbed). If arrived, 0.
                const localElapsed = Math.max(0, elapsed - p.id * 700);
                const travel = Math.max(
                  0,
                  1 - Math.min(localElapsed / 650, 1),
                );
                const d = arrived || m.isCrashed ? 0 : travel;
                if (!m.active) return null;
                if (p.id > ticks + 1) return null;

                const isFraud = p.id === FRAUD_IDX;
                const reached = d < 0.05;
                const rad = (p.angle * Math.PI) / 180;
                // distance in px from center (max ~280)
                const px = Math.cos(rad) * d * 280;
                const py = Math.sin(rad) * d * 280;
                const opacity =
                  reached && !isFraud
                    ? 0
                    : m.isCrashed
                      ? 0
                      : 0.2 + (1 - d) * 0.8;

                return (
                  <div
                    key={p.id}
                    className={`absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 ${
                      isFraud
                        ? "text-red-300"
                        : "text-sky-200"
                    }`}
                    style={{
                      transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                      opacity,
                      transition: "opacity 400ms ease, transform 0ms",
                    }}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isFraud
                          ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]"
                          : "bg-sky-300 shadow-[0_0_6px_rgba(125,211,252,0.8)]"
                      }`}
                    />
                    {d > 0.4 && (
                      <span className="font-mono text-[9px] tabular-nums">
                        {p.charge.card}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* fraud card label when armed */}
        <div
          className={`pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 text-center transition-opacity duration-300 ${
            m.isArmed || m.isResumed ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="font-mono text-lg tabular-nums text-red-300">
            {FRAUD_CARD} · {FRAUD_MERCHANT}
          </div>
          <div className="font-mono text-xs uppercase tracking-[0.25em] text-red-400/70">
            {FRAUD_REASON}
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Glow extinguished."
          footer="Event log intact · orb cached"
        />
        <ReplayingChip active={m.isReplaying} />
        <IdleHint
          eyebrow="fraud sentinel · always on"
          purpose="Breathing. Watching. Remembering."
          active={!m.active}
        />
      </div>

      <ResumedBanner
        active={m.isResumed}
        headline="Giant reopened its eye."
        stat={`${FRAUD_CARD} frozen · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
