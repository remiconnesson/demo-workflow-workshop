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
// Variant 19 · Lighthouse
// Dark sea, scattered tiny ship dots on an offset-x row. Lighthouse (SVG
// left) emits a rotating conical beam (~6s / rotation). As the beam crosses
// a dot, its risk score briefly labels it. On fraud, the beam LOCKS on the
// single red dot, dot grows with halo, "FROZEN" label. Kill: beam cuts out,
// sea darkens. Replay: beam reignites, still locked. Resume: emerald banner.
// ---------------------------------------------------------------------------

const ROT_PERIOD_MS = 6_000;     // one full rotation
const FRAUD_IDX = CHARGES.length - 1;

// Deterministic ship positions inside the sea band (xPct left-to-right).
// Lighthouse sits at x=8%, ships spread 18..96%. Fraud ship is centered high.
function seaPositions(): { x: number; y: number; angle: number }[] {
  const positions: { x: number; y: number; angle: number }[] = [];
  for (let i = 0; i < CHARGES.length; i++) {
    if (i === FRAUD_IDX) {
      positions.push({ x: 68, y: 40, angle: 0 });
      continue;
    }
    const a = Math.sin(i * 17.31) * 3112.7;
    const b = Math.cos(i * 7.77) * 2199.1;
    const af = a - Math.floor(a);
    const bf = b - Math.floor(b);
    const x = 22 + af * 70;  // 22..92
    const y = 22 + bf * 58;  // 22..80
    positions.push({ x, y, angle: 0 });
  }
  // Compute the beam angle needed from lighthouse (at 8, 60) to each ship.
  return positions.map((p) => {
    const dx = p.x - 8;
    const dy = p.y - 60;
    const rad = Math.atan2(dy, dx);
    let deg = (rad * 180) / Math.PI + 90; // 0 = up
    if (deg < 0) deg += 360;
    return { ...p, angle: deg };
  });
}

const SHIPS = seaPositions();
const FRAUD_ANGLE = SHIPS[FRAUD_IDX].angle;

export function LighthouseDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 7_500,
    crashHoldMs: 2_400,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const scanned = 42_804_192 + Math.floor(elapsed / 700) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  const locked =
    m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;

  // Beam angle in deg from lighthouse.
  const liveAngle = (elapsed / ROT_PERIOD_MS) * 360;
  const rotationAngle = locked ? FRAUD_ANGLE : liveAngle;

  // Determine which ships the beam has crossed on its current revolution.
  const currentTurn = liveAngle % 360;
  const beamVisible = m.active && !m.isCrashed;

  // Ship "labeled" = beam within 12° on this rotation.
  function labeled(shipAngle: number): boolean {
    if (!m.active) return false;
    if (locked) return false;
    const diff = Math.abs(((currentTurn - shipAngle + 540) % 360) - 180);
    return diff > 168 && diff <= 180;
  }

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    out.push({ kind: "RUN", msg: "beam.rotate(period: 6s)" });
    if (locked) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "lamp extinguished · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying cached lock" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · lock held" });
    }
    return out;
  }, [m.phase, m.isCrashed, m.isReplaying, m.isResumed, locked]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Lighthouse · keeping watch"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#020509]">
        {/* Corner readouts */}
        <div className="pointer-events-none absolute top-6 left-8 z-10 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            keeper
          </span>
          <span
            className={`font-mono text-xl tabular-nums transition-colors duration-300 ${
              m.isCrashed
                ? "text-red-300"
                : locked
                  ? "text-red-300"
                  : m.isResumed
                    ? "text-emerald-300"
                    : "text-amber-200"
            }`}
          >
            {m.isCrashed
              ? "LAMP OUT"
              : locked
                ? `LOCK · ${Math.round(FRAUD_ANGLE)}°`
                : m.active
                  ? `SWEEP · ${Math.round(currentTurn)}°`
                  : "dark"}
          </span>
        </div>

        <div className="pointer-events-none absolute top-6 right-8 z-10 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            nights on watch
          </span>
          <span className="font-mono text-xl tabular-nums text-zinc-200">
            94
          </span>
        </div>

        {/* Sea backdrop — subtle radial */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 10% 70%, rgba(56,82,120,0.22) 0%, rgba(0,0,0,0.0) 55%), radial-gradient(ellipse at 70% 50%, rgba(30,58,138,0.15) 0%, rgba(0,0,0,0.0) 60%)",
            opacity: m.isCrashed ? 0.2 : 1,
            transition: "opacity 500ms ease",
          }}
        />

        {/* Beam + sea SVG canvas (viewBox 0..100 x 0..100) */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <radialGradient id="beam-grad" cx="0%" cy="0%" r="100%">
              <stop offset="0%" stopColor="rgba(253, 224, 71, 0.45)" />
              <stop offset="60%" stopColor="rgba(253, 224, 71, 0.12)" />
              <stop offset="100%" stopColor="rgba(253, 224, 71, 0.0)" />
            </radialGradient>
            <radialGradient id="beam-grad-locked" cx="0%" cy="0%" r="100%">
              <stop offset="0%" stopColor="rgba(248, 113, 113, 0.55)" />
              <stop offset="60%" stopColor="rgba(248, 113, 113, 0.18)" />
              <stop offset="100%" stopColor="rgba(248, 113, 113, 0.0)" />
            </radialGradient>
          </defs>

          {/* Rotating beam — cone from lighthouse (8, 60), span ~28° */}
          <g
            transform={`rotate(${rotationAngle} 8 60)`}
            style={{
              transition: locked ? "transform 700ms ease-out" : "none",
              opacity: beamVisible ? 1 : 0,
            }}
          >
            <path
              d="M 8 60 L 120 44 A 120 120 0 0 1 120 76 Z"
              fill={locked ? "url(#beam-grad-locked)" : "url(#beam-grad)"}
            />
          </g>

          {/* Ships */}
          {SHIPS.map((s, i) => {
            if (i === FRAUD_IDX) return null;
            const isLabeled = labeled(s.angle);
            return (
              <g key={`s-${i}`} opacity={m.isCrashed ? 0.25 : 1}>
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={0.45}
                  fill="#94a3b8"
                  opacity={0.9}
                  style={{
                    filter: "drop-shadow(0 0 1px rgba(226,232,240,0.5))",
                  }}
                />
                {isLabeled && (
                  <text
                    x={s.x + 1.5}
                    y={s.y - 1.2}
                    fontSize="1.8"
                    fill="rgba(253,224,71,0.95)"
                    fontFamily="ui-monospace, monospace"
                  >
                    {(CHARGES[i]?.risk ?? 0).toFixed(2)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Fraud ship (the one red dot) */}
          <g opacity={m.isCrashed ? 0.3 : 1}>
            {locked && (
              <>
                <circle
                  cx={SHIPS[FRAUD_IDX].x}
                  cy={SHIPS[FRAUD_IDX].y}
                  r={4}
                  fill="none"
                  stroke="rgb(248,113,113)"
                  strokeOpacity="0.6"
                  strokeWidth="0.25"
                >
                  <animate attributeName="r" from="3" to="9" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" from="0.7" to="0" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <circle
                  cx={SHIPS[FRAUD_IDX].x}
                  cy={SHIPS[FRAUD_IDX].y}
                  r={3}
                  fill="rgba(248,113,113,0.25)"
                />
              </>
            )}
            <circle
              cx={SHIPS[FRAUD_IDX].x}
              cy={SHIPS[FRAUD_IDX].y}
              r={locked ? 1.4 : 0.55}
              fill="rgb(248,113,113)"
              style={{
                transition: "r 450ms ease",
                filter: "drop-shadow(0 0 1.8px rgba(248,113,113,0.85))",
              }}
            />
          </g>
        </svg>

        {/* Lighthouse SVG, left anchor */}
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
          <svg
            viewBox="0 0 40 140"
            className="h-[70%] w-auto"
            style={{
              filter: m.isCrashed
                ? "brightness(0.4)"
                : locked
                  ? "drop-shadow(0 0 18px rgba(248,113,113,0.55))"
                  : "drop-shadow(0 0 18px rgba(253,224,71,0.3))",
              transition: "filter 400ms ease",
            }}
          >
            {/* rocks */}
            <path
              d="M 0 130 L 8 112 L 14 120 L 22 108 L 30 116 L 40 126 L 40 140 L 0 140 Z"
              fill="#0a0f1a"
            />
            {/* Tower */}
            <path
              d="M 14 130 L 18 56 L 22 56 L 26 130 Z"
              fill="#1f2937"
              stroke="rgb(255 255 255 / 0.18)"
              strokeWidth="0.5"
            />
            {/* Stripes */}
            <rect x="14" y="76" width="12" height="8" fill="#7f1d1d" opacity="0.6" />
            <rect x="14" y="100" width="12" height="8" fill="#7f1d1d" opacity="0.6" />
            {/* Lamp room */}
            <rect x="13" y="42" width="14" height="14" fill="#111827" stroke="rgb(255 255 255 / 0.2)" strokeWidth="0.4" />
            {/* Lamp bulb */}
            <circle
              cx="20"
              cy="49"
              r="3.4"
              fill={m.isCrashed ? "#450a0a" : locked ? "#ef4444" : m.isResumed ? "#34d399" : "#fde047"}
              style={{
                filter: m.isCrashed
                  ? "none"
                  : `drop-shadow(0 0 8px ${locked ? "#f87171" : m.isResumed ? "#34d399" : "#facc15"})`,
                transition: "fill 400ms ease, filter 400ms ease",
              }}
            />
            {/* Roof */}
            <polygon points="11,42 29,42 20,30" fill="#111827" stroke="rgb(255 255 255 / 0.2)" strokeWidth="0.4" />
            <circle cx="20" cy="27" r="1" fill="#e5e7eb" />
          </svg>
        </div>

        {/* Frozen label near fraud dot */}
        <div
          className={`pointer-events-none absolute transition-opacity duration-300 ${
            locked && !m.isCrashed ? "opacity-100" : "opacity-0"
          }`}
          style={{
            left: `${SHIPS[FRAUD_IDX].x}%`,
            top: `${SHIPS[FRAUD_IDX].y - 7}%`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="rounded-md border border-red-500/60 bg-black/85 px-3 py-1 font-mono text-xs tracking-[0.2em] text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.4)]">
            FROZEN · {FRAUD_CARD}
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Lamp extinguished · process killed"
          footer="Event log intact · lock cached"
        />
        <ReplayingChip active={m.isReplaying} />
        <IdleHint
          eyebrow="fraud sentinel · always on"
          purpose="94 nights of one beam."
          active={!m.active}
        />
      </div>

      <ResumedBanner
        active={m.isResumed}
        headline="94 nights · 1,248 ships turned back"
        stat={`1 lighthouse · 0 dark nights · ${FRAUD_MERCHANT}`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
