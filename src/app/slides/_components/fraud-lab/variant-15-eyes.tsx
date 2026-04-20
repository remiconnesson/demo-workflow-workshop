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
// Variant 15 · Swarm of eyes
// 500 tiny eye dots across a dark field. Each eye blinks asynchronously at ~2Hz.
// Charges cause ~15 random eyes to flash blue then return. On fraud, ALL 500
// eyes STOP BLINKING, INSTANTLY fix their pupils on the fraud point, and red
// lines converge from all of them. Word "SEEN." fades in. Crash closes every
// eye. Replay opens them one by one. Resume leaves one red permanent dot.
// ---------------------------------------------------------------------------

const COLS = 30;
const ROWS = 18;
const EYE_COUNT = COLS * ROWS; // 540

// Fraud target in percent coords (off-center, so lines visibly converge).
const FRAUD_X = 74;
const FRAUD_Y = 42;

// Deterministic per-eye offsets so SSR/CSR agree and every eye blinks uniquely.
type EyeSeed = {
  i: number;
  row: number;
  col: number;
  cx: number; // percent
  cy: number; // percent
  blinkDelayMs: number; // 0..1000
  flashGroup: number; // 0..19
  jitterX: number; // px
  jitterY: number; // px
};

function prng(i: number): number {
  const v = Math.sin(i * 99.17 + 13.7) * 43758.5453;
  return v - Math.floor(v);
}

const EYES: EyeSeed[] = Array.from({ length: EYE_COUNT }, (_, i) => {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  // Base grid with small jitter for organic feel
  const baseX = ((col + 0.5) / COLS) * 100;
  const baseY = ((row + 0.5) / ROWS) * 100;
  return {
    i,
    row,
    col,
    cx: baseX,
    cy: baseY,
    blinkDelayMs: Math.floor(prng(i * 3.17) * 1000),
    flashGroup: Math.floor(prng(i * 7.3) * 20),
    jitterX: (prng(i * 1.9) - 0.5) * 0.8,
    jitterY: (prng(i * 2.6) - 0.5) * 0.8,
  };
});

export function EyesDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_000,
    crashHoldMs: 2_200,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const ticks = Math.floor(elapsed / 500);
  const scanned = 42_804_192 + Math.min(ticks, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);
  const blinks = 9_417_218 + Math.min(ticks * 11, 9999);

  // Pick a flash group every few ticks (~15 eyes flash blue on each charge).
  const flashGroup = ticks % 20;

  const locked = m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;
  const eyesClosed = m.isCrashed;

  // Replay — open eyes one by one based on index
  const openProgress = m.isReplaying
    ? Math.min(1, (elapsed % 1800) / 1500)
    : 1;
  const openUpTo = m.isReplaying
    ? Math.floor(openProgress * EYE_COUNT)
    : EYE_COUNT;

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    out.push({ kind: "RUN", msg: `eyes.focus(n: 500)` });
    if (locked) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "eyes closed · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "opening eyes" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, locked, m.isCrashed, m.isReplaying, m.isResumed]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Eyes · swarm"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black">
        {/* Corner readout */}
        <div className="pointer-events-none absolute top-6 left-8 z-20 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            eyes
          </span>
          <span
            className={`font-mono text-xl tabular-nums transition-colors duration-300 ${
              locked ? "text-red-300" : "text-zinc-200"
            }`}
          >
            500 · UPTIME 94d
          </span>
        </div>
        <div className="pointer-events-none absolute top-6 right-8 z-20 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            blinks
          </span>
          <span className="font-mono text-xl tabular-nums text-zinc-300">
            {blinks.toLocaleString()}
          </span>
        </div>

        {/* Swarm layer */}
        <div className="absolute inset-0">
          {/* SVG layer for convergence lines (below eyes) */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            {locked &&
              !eyesClosed &&
              EYES.filter((_, i) => i % 6 === 0).map((e) => (
                <line
                  key={`ln-${e.i}`}
                  x1={e.cx + e.jitterX}
                  y1={e.cy + e.jitterY}
                  x2={FRAUD_X}
                  y2={FRAUD_Y}
                  stroke="rgb(248,113,113)"
                  strokeOpacity="0.18"
                  strokeWidth="0.08"
                  style={{
                    transition: "stroke-opacity 400ms ease",
                  }}
                />
              ))}
          </svg>

          {/* Eyes grid */}
          <div className="relative h-full w-full">
            {EYES.map((e) => (
              <Eye
                key={e.i}
                eye={e}
                fraudX={FRAUD_X}
                fraudY={FRAUD_Y}
                locked={locked}
                closed={eyesClosed || e.i >= openUpTo}
                flashing={!locked && !eyesClosed && e.flashGroup === flashGroup}
                isResumed={m.isResumed}
              />
            ))}
          </div>

          {/* Fraud point marker + SEEN label */}
          <div
            className="pointer-events-none absolute flex flex-col items-center gap-3"
            style={{
              left: `${FRAUD_X}%`,
              top: `${FRAUD_Y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              className={`h-5 w-5 rounded-full transition-all duration-300 ${
                locked
                  ? "bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.95)]"
                  : "bg-red-400/0"
              } ${m.isResumed ? "animate-pulse" : ""}`}
            />
            <div
              className={`text-center transition-opacity duration-500 ${
                locked ? "opacity-100" : "opacity-0"
              }`}
            >
              <p className="font-mono text-5xl font-black tracking-[0.3em] text-red-300 drop-shadow-[0_0_16px_rgba(248,113,113,0.6)]">
                SEEN.
              </p>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.3em] text-red-400">
                {FRAUD_CARD} · {FRAUD_MERCHANT}
              </p>
            </div>
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Eyes closed · process killed"
          footer="Event log intact · gaze cached"
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

// --- eye ----------------------------------------------------------------

function Eye({
  eye,
  fraudX,
  fraudY,
  locked,
  closed,
  flashing,
  isResumed,
}: {
  eye: EyeSeed;
  fraudX: number;
  fraudY: number;
  locked: boolean;
  closed: boolean;
  flashing: boolean;
  isResumed: boolean;
}) {
  // Compute a pupil offset pointing at the fraud point (in % delta),
  // normalized so the pupil sits at the edge of the eye.
  const dx = fraudX - eye.cx;
  const dy = fraudY - eye.cy;
  const mag = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
  const pupilShiftX = (dx / mag) * 0.9; // px within the 4px eye
  const pupilShiftY = (dy / mag) * 0.9;

  const pupilColor = locked
    ? "rgb(248,113,113)"
    : flashing
      ? "rgb(56,189,248)"
      : "rgb(161,161,170)";

  return (
    <div
      className="absolute"
      style={{
        left: `${eye.cx + eye.jitterX}%`,
        top: `${eye.cy + eye.jitterY}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Eye shape — white sclera ellipse, pupil inside */}
      <div
        className="relative flex h-3 w-4 items-center justify-center rounded-full transition-opacity duration-300"
        style={{
          backgroundColor: closed ? "transparent" : "rgba(244,244,245,0.18)",
          boxShadow: closed
            ? "none"
            : flashing
              ? "0 0 6px rgba(56,189,248,0.7)"
              : locked
                ? "0 0 5px rgba(248,113,113,0.5)"
                : "0 0 2px rgba(244,244,245,0.2)",
          opacity: closed ? 0.2 : 1,
          animation: closed || locked
            ? "none"
            : `eye-blink 1.4s ${eye.blinkDelayMs}ms infinite`,
          transition: "box-shadow 200ms ease, background-color 200ms ease",
        }}
      >
        {/* pupil */}
        <div
          className="h-1.5 w-1.5 rounded-full transition-all"
          style={{
            backgroundColor: pupilColor,
            transform: locked
              ? `translate(${pupilShiftX}px, ${pupilShiftY}px)`
              : "translate(0, 0)",
            transitionDuration: locked ? "40ms" : "300ms",
            opacity: closed ? 0 : 1,
            boxShadow: isResumed && locked
              ? "0 0 3px rgba(248,113,113,0.9)"
              : "none",
          }}
        />
      </div>

      {/* Eyelid (close animation) — solid bar over the eye */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full bg-black transition-transform duration-300"
        style={{
          transform: closed ? "scaleY(1)" : "scaleY(0)",
          transformOrigin: "center",
        }}
      />

      <style>{`
        @keyframes eye-blink {
          0%, 94%, 100% { opacity: 1; }
          96% { opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
