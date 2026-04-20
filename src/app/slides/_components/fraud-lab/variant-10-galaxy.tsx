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
// Variant 10 · Galaxy
// Slowly-rotating spiral galaxy. Each charge is a star along the spiral.
// When the sentinel "correlates" charges, faint gold lines draw between
// related points and fade. On fraud, the •••• 8891 star lights RED on the
// outer rim. Gold-then-red lines draw to three anomaly nodes — a prior
// 8891 charge, the merchant node, a geo pin labeled RU — forming a red
// constellation. Label "CONSTELLATION DETECTED" fades in. On crash the
// galaxy dims but keeps rotating (inertia). On resume a final gold line
// snaps from the constellation to a FROZEN icon.
// ---------------------------------------------------------------------------

const FRAUD_IDX = CHARGES.length - 1;

// Place each charge on a logarithmic spiral arm.
type StarPos = { x: number; y: number; r: number };

function spiralPos(i: number, total: number, armCount = 3): StarPos {
  const cx = 50;
  const cy = 50;
  const t = i / total;
  // arm offset — spread evenly
  const armSeed = Math.sin(i * 9.81) * 43758.5;
  const arm = Math.floor(((armSeed - Math.floor(armSeed)) * armCount));
  const angle = (arm / armCount) * Math.PI * 2 + t * Math.PI * 2.2;
  const radius = 8 + t * 34;
  const jitterA = Math.sin(i * 12.9898) * 43758.5;
  const jitterB = Math.sin(i * 78.233) * 43758.5;
  const jx = ((jitterA - Math.floor(jitterA)) - 0.5) * 3.2;
  const jy = ((jitterB - Math.floor(jitterB)) - 0.5) * 3.2;
  return {
    x: cx + radius * Math.cos(angle) + jx,
    y: cy + radius * Math.sin(angle) + jy,
    r: 0.45 + (1 - t) * 0.9,
  };
}

// Build an extended starfield of 80 ambient stars + charge stars mapped on top.
const AMBIENT_STARS: StarPos[] = Array.from({ length: 160 }, (_, i) => spiralPos(i, 160));
const CHARGE_STARS: StarPos[] = CHARGES.map((_, i) =>
  // Place charge stars at consistent positions along the same spiral, spaced out.
  spiralPos(10 + i * 13, 160, 3),
);

// Force fraud to the outer rim — overwrite the last charge star's position.
CHARGE_STARS[FRAUD_IDX] = { x: 82, y: 68, r: 1.1 };

// Anomaly nodes for the fraud constellation.
const ANOMALY_NODES = [
  // prior 8891 charge — placed in another arm
  { x: 22, y: 32, label: "prior 8891 · apr 6", tone: "anomaly" as const },
  // merchant node — new entity
  { x: 70, y: 20, label: "cryptonome-xyz · new", tone: "anomaly" as const },
  // RU geo pin
  { x: 32, y: 78, label: "geo · RU", tone: "anomaly" as const },
];

// Frozen icon target for the resume line.
const FROZEN_ICON = { x: 82, y: 90 };

export function GalaxyDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_000,
    crashHoldMs: 2_200,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const pauseOnFraud =
    m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;

  // How many stars have been scanned and lit
  const scanTick = Math.floor(elapsed / 500);
  const lit = Math.min(scanTick, FRAUD_IDX);
  const scanned = 42_804_192 + lit * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  // Rolling "live correlation" — gold lines fade in/out between recent stars
  const liveCorrelations = useMemo(() => {
    // deterministic pairs pulled each ~1.5s
    const frame = Math.floor(elapsed / 1500);
    const out: { a: number; b: number; key: string }[] = [];
    for (let k = 0; k < 3; k++) {
      const a = (frame * 3 + k) % Math.max(1, FRAUD_IDX);
      const b = (frame * 5 + k * 2 + 1) % Math.max(1, FRAUD_IDX);
      if (a !== b) out.push({ a, b, key: `${frame}-${k}` });
    }
    return out;
  }, [elapsed]);

  // Constellation formation progress (0 → 1) once armed
  const armStart = 8_000;
  const armElapsed = Math.max(0, elapsed - armStart);
  const CONSTELLATION_DRAW_MS = 1_800;
  let constellationProgress = 0;
  if (m.isArmed) {
    constellationProgress = Math.min(1, armElapsed / CONSTELLATION_DRAW_MS);
  } else if (m.isCrashed) {
    // Paused mid-draw (inertia)
    constellationProgress = Math.min(0.6, armElapsed / CONSTELLATION_DRAW_MS);
  } else if (m.isReplaying || m.isResumed) {
    constellationProgress = 1;
  }

  const showConstellation = pauseOnFraud;

  // Pulse for the red constellation once formed
  const pulse = showConstellation && constellationProgress >= 1
    ? 0.85 + 0.15 * Math.sin(elapsed / 260)
    : 1;

  // On resume, draw a final gold line to the frozen icon
  const frozenLinePct = m.isResumed ? 1 : 0;

  // Galaxy dim on crash but keeps rotating
  const galaxyDim = m.isCrashed ? 0.4 : 1;

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    if (lit > 0) {
      out.push({ kind: "RUN", msg: `correlate(batch: ${lit} cleared)` });
    }
    if (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "orbit severed · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying event log" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, lit, m.isArmed, m.isCrashed, m.isReplaying, m.isResumed]);

  // Anomaly line geometry from fraud star → each anomaly node
  const fraudStar = CHARGE_STARS[FRAUD_IDX];
  const anomalyLines = ANOMALY_NODES.map((n) => ({
    x1: fraudStar.x,
    y1: fraudStar.y,
    x2: n.x,
    y2: n.y,
  }));

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Galaxy · correlation"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black">
        <style>{`
          @keyframes galaxy-rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes galaxy-draw-line {
            from { stroke-dashoffset: 100; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes galaxy-line-fade {
            0% { opacity: 0; stroke-dashoffset: 100; }
            40% { opacity: 0.7; stroke-dashoffset: 0; }
            100% { opacity: 0; stroke-dashoffset: 0; }
          }
        `}</style>

        {/* slow-rotating galaxy group */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          style={{ opacity: galaxyDim, transition: "opacity 500ms ease" }}
        >
          <defs>
            <radialGradient id="galaxy-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,240,220,0.35)" />
              <stop offset="60%" stopColor="rgba(255,240,220,0.05)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <radialGradient id="galaxy-red" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(248,113,113,1)" />
              <stop offset="100%" stopColor="rgba(248,113,113,0)" />
            </radialGradient>
          </defs>

          {/* rotating layer — galaxy body (stars + ambient) */}
          <g
            style={{
              transformOrigin: "50% 50%",
              animation: "galaxy-rotate 90s linear infinite",
            }}
          >
            {/* core glow */}
            <circle cx="50" cy="50" r="18" fill="url(#galaxy-core)" />

            {/* ambient stars */}
            {AMBIENT_STARS.map((s, i) => (
              <circle
                key={`amb-${i}`}
                cx={s.x}
                cy={s.y}
                r={s.r * 0.2}
                fill="white"
                opacity={0.28 + ((i * 13) % 7) * 0.08}
              />
            ))}

            {/* charge stars */}
            {CHARGE_STARS.map((s, i) => {
              if (i === FRAUD_IDX) return null;
              const isLit = i <= lit || pauseOnFraud;
              return (
                <circle
                  key={`ch-${i}`}
                  cx={s.x}
                  cy={s.y}
                  r={s.r * 0.6}
                  fill="rgb(187,247,208)"
                  opacity={isLit ? 0.95 : 0.25}
                  style={{
                    transition: "opacity 400ms ease",
                    filter: isLit ? "drop-shadow(0 0 1.6px rgba(187,247,208,0.9))" : "none",
                  }}
                />
              );
            })}

            {/* fraud star - red, pulsing */}
            <g opacity={pauseOnFraud ? 1 : 0} style={{ transition: "opacity 400ms ease" }}>
              <circle
                cx={fraudStar.x}
                cy={fraudStar.y}
                r="3"
                fill="url(#galaxy-red)"
              />
              <circle
                cx={fraudStar.x}
                cy={fraudStar.y}
                r="0.9"
                fill="rgb(248,113,113)"
                style={{ filter: "drop-shadow(0 0 3px rgba(248,113,113,1))" }}
              />
            </g>
          </g>

          {/* Non-rotating overlay — correlation lines, anomaly markers, label */}
          <g>
            {/* live gold correlations (fade in/out) — hidden once armed */}
            {!pauseOnFraud && m.active &&
              liveCorrelations.map((c) => {
                const a = CHARGE_STARS[c.a];
                const b = CHARGE_STARS[c.b];
                if (!a || !b) return null;
                return (
                  <line
                    key={c.key}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="rgb(253,224,71)"
                    strokeWidth="0.25"
                    strokeDasharray="100"
                    style={{
                      animation: "galaxy-line-fade 1.4s ease-out forwards",
                      filter: "drop-shadow(0 0 1px rgba(253,224,71,0.6))",
                    }}
                  />
                );
              })}

            {/* Anomaly constellation lines — gold first, then red */}
            {anomalyLines.map((l, i) => {
              const pct = Math.min(1, Math.max(0, (constellationProgress * 3) - i));
              // "draw" using dash offset
              const length = Math.sqrt(
                (l.x2 - l.x1) ** 2 + (l.y2 - l.y1) ** 2,
              );
              return (
                <g key={`a-${i}`}>
                  <line
                    x1={l.x1}
                    y1={l.y1}
                    x2={l.x2}
                    y2={l.y2}
                    stroke={constellationProgress >= 1 ? "rgb(248,113,113)" : "rgb(253,224,71)"}
                    strokeWidth="0.45"
                    strokeDasharray={length}
                    strokeDashoffset={length * (1 - pct)}
                    opacity={pauseOnFraud ? pulse : 0}
                    style={{
                      transition: "stroke 400ms ease, stroke-dashoffset 600ms ease, opacity 300ms ease",
                      filter: "drop-shadow(0 0 2px rgba(248,113,113,0.55))",
                    }}
                  />
                </g>
              );
            })}

            {/* Anomaly nodes */}
            {ANOMALY_NODES.map((n, i) => (
              <g key={`n-${i}`} opacity={pauseOnFraud ? 1 : 0} style={{ transition: "opacity 400ms ease" }}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r="1.2"
                  fill="none"
                  stroke="rgb(248,113,113)"
                  strokeWidth="0.35"
                />
                <circle cx={n.x} cy={n.y} r="0.5" fill="rgb(248,113,113)" />
                <text
                  x={n.x + 2}
                  y={n.y + 0.6}
                  fontSize="1.6"
                  fontFamily="ui-monospace, Menlo, monospace"
                  fill="rgb(254,202,202)"
                >
                  {n.label}
                </text>
              </g>
            ))}

            {/* Frozen icon + line (resumed) */}
            <g opacity={m.isResumed ? 1 : 0} style={{ transition: "opacity 500ms ease" }}>
              <line
                x1={fraudStar.x}
                y1={fraudStar.y}
                x2={FROZEN_ICON.x}
                y2={FROZEN_ICON.y}
                stroke="rgb(253,224,71)"
                strokeWidth="0.35"
                strokeDasharray="30"
                strokeDashoffset={30 * (1 - frozenLinePct)}
                style={{
                  transition: "stroke-dashoffset 700ms ease 200ms",
                  filter: "drop-shadow(0 0 1.6px rgba(253,224,71,0.6))",
                }}
              />
              <rect
                x={FROZEN_ICON.x - 3.5}
                y={FROZEN_ICON.y - 2}
                width="7"
                height="4"
                rx="0.5"
                fill="rgba(248,113,113,0.2)"
                stroke="rgb(248,113,113)"
                strokeWidth="0.25"
              />
              <text
                x={FROZEN_ICON.x}
                y={FROZEN_ICON.y + 0.8}
                fontSize="1.7"
                fontFamily="ui-monospace, Menlo, monospace"
                fontWeight="700"
                fill="rgb(254,202,202)"
                textAnchor="middle"
              >
                FROZEN
              </text>
            </g>
          </g>
        </svg>

        {/* Center headline */}
        <div
          className={`pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ${
            pauseOnFraud && constellationProgress >= 1
              ? "opacity-100"
              : "opacity-0"
          }`}
        >
          <div className="rounded-2xl border border-red-500/50 bg-black/60 px-8 py-4 text-center shadow-[0_0_40px_rgba(248,113,113,0.4)]">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-red-300">
              anomaly
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-red-100">
              constellation detected
            </p>
            <p className="mt-1 font-mono text-sm text-red-200">
              {FRAUD_CARD} · {FRAUD_MERCHANT} · {FRAUD_COUNTRY}
            </p>
          </div>
        </div>

        {/* Orbit severed (crash) */}
        <div
          className={`pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${
            m.isCrashed ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="rounded-full border border-red-500/60 bg-black/70 px-5 py-2 font-mono text-sm uppercase tracking-[0.3em] text-red-300">
            orbit severed · inertia only
          </span>
        </div>

        {/* Corner status */}
        <div className="pointer-events-none absolute top-6 left-8 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            correlation
          </span>
          <span
            className={`font-mono text-2xl tabular-nums transition-colors duration-300 ${
              pauseOnFraud ? "text-red-300" : "text-emerald-300"
            }`}
          >
            {pauseOnFraud ? "0.93 · locked" : `${lit} stars · 94d`}
          </span>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Orbit severed · process killed"
          footer="Galaxy drifts · cache intact"
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
        headline="Constellation held."
        stat={`${FRAUD_CARD} frozen · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
