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
// Variant 18 · Guardian statue
// Stone guardian silhouette (left). A right-to-left stream of orbs = charges.
// Fraud orb is red. When it reaches the guardian, a stone hand EMERGES and
// catches it — orb and hand freeze in place. Kill dims the guardian & hand.
// Replay the hand trembles but still holds the orb. Resume: emerald
// "94 days of watch · 0 fraud escaped."
// ---------------------------------------------------------------------------

const ORB_TRAVEL_MS = 6_000;           // time from right edge to guardian
const ORB_INTERVAL_MS = 700;           // spawn cadence
const FRAUD_IDX = CHARGES.length - 1;

// Deterministic per-orb vertical lane (8 lanes across stream band)
function laneOf(i: number): number {
  const v = Math.sin(i * 73.31) * 4312.1;
  const f = v - Math.floor(v);
  return 0.2 + f * 0.6; // 0.2..0.8 normalized height of stream band
}

export function GuardianDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 7_500,
    crashHoldMs: 2_400,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const scanned = 42_804_192 + Math.floor(elapsed / 700) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  // Determine which orbs exist, their positions in percent of the band width.
  // orb i spawns at i * ORB_INTERVAL_MS. Its age = elapsed - spawn. Position
  // travels from 100% (right) → 18% (guardian grip) over ORB_TRAVEL_MS.
  const caught =
    m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;

  // Compute positions of the last N orbs, keeping it deterministic.
  const N_ORBS = 14;
  const orbs = Array.from({ length: N_ORBS }).map((_, k) => {
    const i = k;
    const spawnAt = i * ORB_INTERVAL_MS;
    const age = elapsed - spawnAt;
    const active = age > 0;
    const t = Math.min(Math.max(age / ORB_TRAVEL_MS, 0), 1);
    const isFraud = i === FRAUD_IDX;
    // fraud orb locks at guardian grip (x=18%) once caught phase is on
    const xPct =
      caught && isFraud ? 20 : 100 - t * 82; // ends at ~18%
    const lane = laneOf(i);
    const riskV = CHARGES[i]?.risk ?? 0.1;
    return { i, spawnAt, active, xPct, lane, risk: riskV, isFraud };
  });

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    out.push({ kind: "RUN", msg: "guardian.watch(lanes: 8)" });
    if (caught) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "guardian dimmed · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying cached grip" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · grip held" });
    }
    return out;
  }, [m.phase, m.isCrashed, m.isReplaying, m.isResumed, caught]);

  // Guardian color states
  const stoneFill = m.isCrashed ? "#1a1010" : "#1e1b1a";
  const stoneStroke = m.isCrashed ? "#3a1a1a" : "#3a3532";
  const eyeFill = m.isCrashed
    ? "#450a0a"
    : caught
      ? "#ef4444"
      : m.isResumed
        ? "#34d399"
        : "#d6d3d1";

  const handEmerged = caught;
  const handColor = m.isCrashed ? "#4b1d1d" : "#78716c";

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Guardian · constant watch"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0a0a0a] to-black">
        {/* Corner readout */}
        <div className="pointer-events-none absolute top-6 left-8 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            watch
          </span>
          <span
            className={`font-mono text-xl tabular-nums transition-colors duration-300 ${
              m.isCrashed
                ? "text-red-300"
                : caught
                  ? "text-red-300"
                  : m.isResumed
                    ? "text-emerald-300"
                    : "text-zinc-200"
            }`}
          >
            {m.isCrashed
              ? "STONE DIMMED"
              : caught
                ? "GRIP LOCKED"
                : m.active
                  ? "streaming"
                  : "stillness"}
          </span>
        </div>

        <div className="pointer-events-none absolute top-6 right-8 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            lanes
          </span>
          <span className="font-mono text-xl tabular-nums text-zinc-200">
            8 · −→ west
          </span>
        </div>

        {/* Stream band */}
        <div className="absolute inset-x-0 top-[40%] bottom-[15%] mx-8 overflow-hidden">
          {/* Lane guides */}
          <svg
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            {[10, 20, 30].map((y) => (
              <line
                key={y}
                x1={0}
                x2={100}
                y1={y}
                y2={y}
                stroke="rgb(255 255 255 / 0.035)"
                strokeWidth="0.15"
              />
            ))}
          </svg>

          {/* Orbs */}
          <div className="absolute inset-0">
            {orbs.map((o) => {
              if (!o.active) return null;
              // vertical lane based on laneOf (top..bottom of band)
              const topPct = o.lane * 100;
              const riskColor = o.isFraud
                ? "#ef4444"
                : o.risk > 0.3
                  ? "#fcd34d"
                  : "#34d399";
              const glow = o.isFraud
                ? "0 0 24px rgba(248,113,113,0.75)"
                : o.risk > 0.3
                  ? "0 0 12px rgba(252,211,77,0.45)"
                  : "0 0 10px rgba(52,211,153,0.35)";
              return (
                <div
                  key={o.i}
                  className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${o.xPct}%`,
                    top: `${topPct}%`,
                    background: riskColor,
                    boxShadow: glow,
                    opacity: m.isCrashed ? 0.35 : 1,
                    transition:
                      caught && o.isFraud
                        ? "left 600ms ease-out, top 600ms ease-out, opacity 400ms ease"
                        : "opacity 400ms ease",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Guardian SVG — left side, center */}
        <div className="absolute inset-y-0 left-0 flex w-1/3 items-center justify-center">
          <svg
            viewBox="0 0 100 140"
            className="h-[min(84%,640px)]"
            style={{
              filter: m.isCrashed
                ? "brightness(0.5)"
                : caught
                  ? "drop-shadow(0 0 18px rgba(248,113,113,0.35))"
                  : m.isResumed
                    ? "drop-shadow(0 0 18px rgba(52,211,153,0.35))"
                    : "drop-shadow(0 0 10px rgba(255,255,255,0.08))",
              transition: "filter 500ms ease",
            }}
          >
            <defs>
              <linearGradient id="stone-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stoneFill} />
                <stop offset="100%" stopColor="#050505" />
              </linearGradient>
            </defs>

            {/* Plinth */}
            <rect
              x="18"
              y="118"
              width="62"
              height="18"
              fill="#0d0d0d"
              stroke={stoneStroke}
              strokeWidth="0.5"
            />
            {/* Body (robed silhouette) */}
            <path
              d="M 50 22
                 C 36 22, 28 34, 28 50
                 L 24 120
                 L 76 120
                 L 72 50
                 C 72 34, 64 22, 50 22 Z"
              fill="url(#stone-grad)"
              stroke={stoneStroke}
              strokeWidth="0.8"
            />
            {/* Head */}
            <circle
              cx="50"
              cy="18"
              r="10"
              fill={stoneFill}
              stroke={stoneStroke}
              strokeWidth="0.8"
            />
            {/* Eyes */}
            <circle
              cx="46"
              cy="18"
              r="1.2"
              fill={eyeFill}
              style={{
                filter:
                  caught || m.isResumed
                    ? `drop-shadow(0 0 2px ${eyeFill})`
                    : "none",
                transition: "fill 400ms ease",
              }}
            />
            <circle
              cx="54"
              cy="18"
              r="1.2"
              fill={eyeFill}
              style={{
                filter:
                  caught || m.isResumed
                    ? `drop-shadow(0 0 2px ${eyeFill})`
                    : "none",
                transition: "fill 400ms ease",
              }}
            />

            {/* Left tucked arm (static) */}
            <path
              d="M 30 55 C 26 66, 28 88, 34 98 L 40 96 C 36 88, 34 74, 36 60 Z"
              fill={stoneFill}
              stroke={stoneStroke}
              strokeWidth="0.5"
            />

            {/* Right arm — EMERGES on fraud. Translates right & rotates. */}
            <g
              style={{
                transform: handEmerged
                  ? "translate(34px, -8px) rotate(-14deg)"
                  : "translate(0px, 0px) rotate(0deg)",
                transformOrigin: "70px 60px",
                transition:
                  "transform 750ms cubic-bezier(0.22, 1, 0.36, 1), filter 400ms ease",
                filter: m.isReplaying
                  ? "url(#tremble)"
                  : "none",
              }}
            >
              <path
                d="M 70 55 C 74 66, 74 86, 68 96 L 62 96 C 66 86, 66 70, 64 60 Z"
                fill={stoneFill}
                stroke={stoneStroke}
                strokeWidth="0.5"
              />
              {/* Hand/palm */}
              <g transform="translate(68 55)">
                <circle
                  cx="0"
                  cy="0"
                  r="7"
                  fill={handColor}
                  stroke={stoneStroke}
                  strokeWidth="0.5"
                />
                {/* Fingers */}
                <rect x="-1.5" y="-11" width="3" height="7" rx="1.4" fill={handColor} />
                <rect x="-5" y="-10" width="3" height="6" rx="1.4" fill={handColor} />
                <rect x="2" y="-10" width="3" height="6" rx="1.4" fill={handColor} />
                <rect x="-8" y="-6" width="3" height="5" rx="1.4" fill={handColor} transform="rotate(-25 -6.5 -3.5)" />
              </g>
            </g>

            {/* Tremble filter for replay */}
            <defs>
              <filter id="tremble" x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.9"
                  numOctaves="1"
                  seed="3"
                >
                  <animate
                    attributeName="seed"
                    values="1;2;3;4;5"
                    dur="0.3s"
                    repeatCount="indefinite"
                  />
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" scale="1.2" />
              </filter>
            </defs>
          </svg>
        </div>

        {/* Caught orb label */}
        <div
          className={`pointer-events-none absolute bottom-24 left-1/3 -translate-x-1/2 transition-opacity duration-300 ${
            caught && !m.isCrashed ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="rounded-xl border border-red-500/60 bg-black/85 px-5 py-2 font-mono text-sm text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.4)]">
            HELD · {FRAUD_CARD} · {FRAUD_MERCHANT}
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Guardian dimmed · process killed"
          footer="Event log intact · grip cached"
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
        headline="94 days of watch · 0 fraud escaped"
        stat={`${FRAUD_CARD} held · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
