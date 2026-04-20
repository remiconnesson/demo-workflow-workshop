"use client";

import { useMemo } from "react";
import { AgentDebugDrawer, type DebugEvent } from "../agent-debug-drawer";
import {
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
// Variant 20 · Aquarium
// Deep-sea scene. 10 cephalopod blobs float at deterministic positions with
// gentle sine-driven translateY drift. Each frame, one flashes (review).
// On fraud, CENTER cephalopod turns blood red with diagonal stripes and all
// others freeze looking toward it. Kill: glass cracks + creatures dim.
// Replay: cracks heal; red cephalopod keeps the alarm flash. Resume: banner.
// ---------------------------------------------------------------------------

const N_CREATURES = 10;
const FLASH_PERIOD_MS = 700;        // cadence of review flashes
const FRAUD_CREATURE_IDX = 4;       // center

type Creature = {
  i: number;
  xPct: number;
  yPct: number;
  scale: number;
  phase: number;
  flip: boolean;
};

function creatures(): Creature[] {
  const arr: Creature[] = [];
  // Hand-curated, deterministic positions in the tank (xPct, yPct)
  const spots: [number, number, number, boolean][] = [
    [12, 30, 0.85, false],
    [28, 72, 1.05, true],
    [22, 50, 0.75, false],
    [40, 22, 0.95, true],
    [50, 50, 1.3, false],    // center = fraud cephalopod
    [60, 78, 0.9, true],
    [72, 30, 1.0, false],
    [80, 55, 0.85, true],
    [88, 80, 0.75, false],
    [66, 12, 0.7, true],
  ];
  for (let i = 0; i < N_CREATURES; i++) {
    const [x, y, s, flip] = spots[i];
    arr.push({ i, xPct: x, yPct: y, scale: s, phase: i * 0.7, flip });
  }
  return arr;
}

const CREATURES = creatures();

export function AquariumDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 7_500,
    crashHoldMs: 2_400,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const scanned = 42_804_192 + Math.floor(elapsed / 700) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  const alarm = m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;

  // "Review flash": rotate through creatures, one flashing at a time, skipping
  // the fraud creature. Frozen during alarm.
  const fi = Math.floor(elapsed / FLASH_PERIOD_MS);
  const flashingIdx = alarm
    ? -1
    : ((fi % (N_CREATURES - 1)) >= FRAUD_CREATURE_IDX
      ? (fi % (N_CREATURES - 1)) + 1
      : fi % (N_CREATURES - 1));

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    out.push({ kind: "RUN", msg: "tank.watch(creatures: 10)" });
    if (alarm) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "glass cracked · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying cached alarm" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · alarm held" });
    }
    return out;
  }, [m.phase, m.isCrashed, m.isReplaying, m.isResumed, alarm]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Aquarium · deep watch"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10"
        style={{
          background:
            "linear-gradient(180deg, #04182b 0%, #020a16 45%, #000000 100%)",
        }}
      >
        {/* Subtle caustic light */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 10%, rgba(56,189,248,0.08) 0%, rgba(0,0,0,0) 55%), radial-gradient(ellipse at 70% 5%, rgba(96,165,250,0.06) 0%, rgba(0,0,0,0) 55%)",
            opacity: m.isCrashed ? 0.2 : 1,
            transition: "opacity 500ms ease",
          }}
        />

        {/* Corner readouts */}
        <div className="pointer-events-none absolute top-6 left-8 z-10 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            depth
          </span>
          <span
            className={`font-mono text-xl tabular-nums transition-colors duration-300 ${
              m.isCrashed
                ? "text-red-300"
                : alarm
                  ? "text-red-300"
                  : m.isResumed
                    ? "text-emerald-300"
                    : "text-sky-300"
            }`}
          >
            {m.isCrashed
              ? "GLASS CRACKED"
              : alarm
                ? "ALARM HELD"
                : m.active
                  ? "calm · 120m"
                  : "still"}
          </span>
        </div>

        <div className="pointer-events-none absolute top-6 right-8 z-10 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            creatures
          </span>
          <span className="font-mono text-xl tabular-nums text-zinc-200">
            {N_CREATURES} on watch
          </span>
        </div>

        {/* Creatures layer */}
        <div className="absolute inset-0">
          {CREATURES.map((c) => {
            const isFraudC = c.i === FRAUD_CREATURE_IDX;
            const isFlashing = !alarm && c.i === flashingIdx;
            // Drift amount — sine of elapsed + phase.
            const driftY =
              !alarm && m.active
                ? Math.sin(elapsed / 800 + c.phase) * 1.2
                : 0;
            const tilt =
              alarm && !isFraudC
                ? // All others tilt toward the center cephalopod
                  (c.xPct < 50 ? 12 : -12)
                : 0;

            const base = m.isCrashed ? 0.35 : 1;

            return (
              <div
                key={c.i}
                className="absolute"
                style={{
                  left: `${c.xPct}%`,
                  top: `${c.yPct}%`,
                  transform: `translate(-50%, calc(-50% + ${driftY}%)) scale(${c.scale}) rotate(${tilt}deg) ${c.flip ? "scaleX(-1)" : ""}`,
                  transformOrigin: "center",
                  opacity: base,
                  transition:
                    "transform 700ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease",
                }}
              >
                <Octopus
                  fraud={isFraudC && alarm}
                  flashing={isFlashing}
                  resumed={m.isResumed && !isFraudC}
                />
              </div>
            );
          })}
        </div>

        {/* Glass crack overlay (crashed) */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{
            opacity: m.isCrashed ? 1 : 0,
            transition: "opacity 300ms ease",
          }}
        >
          <g
            stroke="rgba(248,113,113,0.8)"
            strokeWidth="0.25"
            fill="none"
            style={{ filter: "drop-shadow(0 0 1px rgba(248,113,113,0.9))" }}
          >
            <path d="M 0 20 L 30 28 L 48 22 L 72 34 L 100 30" />
            <path d="M 0 62 L 22 58 L 40 70 L 66 56 L 100 68" />
            <path d="M 12 0 L 30 40 L 46 50 L 54 80 L 70 100" />
            <path d="M 80 0 L 72 30 L 84 50 L 78 80 L 90 100" />
            <path d="M 48 22 L 40 34 L 30 28" />
            <path d="M 48 22 L 58 32 L 62 42" />
            <path d="M 46 50 L 58 44 L 66 56" />
            <path d="M 54 80 L 42 70 L 30 74" />
          </g>
        </svg>

        {/* Center label for fraud cephalopod */}
        <div
          className={`pointer-events-none absolute left-1/2 top-[60%] -translate-x-1/2 transition-opacity duration-300 ${
            alarm && !m.isCrashed ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="rounded-xl border border-red-500/60 bg-black/85 px-5 py-2 font-mono text-sm text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.4)]">
            ALARM · {FRAUD_CARD} · {FRAUD_MERCHANT}
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Glass cracked · process killed"
          footer="Event log intact · alarm cached"
        />
        <ReplayingChip active={m.isReplaying} />
        <IdleHint
          eyebrow="fraud sentinel · always on"
          purpose="94 days of one tank."
          active={!m.active}
        />
      </div>

      <ResumedBanner
        active={m.isResumed}
        headline="94 days watched · 2,041 creatures"
        stat="1 alarm · all held · 0 re-executions"
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}

// --- Octopus SVG ---------------------------------------------------------

function Octopus({
  fraud,
  flashing,
  resumed,
}: {
  fraud: boolean;
  flashing: boolean;
  resumed: boolean;
}) {
  const baseFill = fraud
    ? "url(#octo-fraud)"
    : resumed
      ? "#34d399"
      : "#8ab4c4";
  const glow = fraud
    ? "drop-shadow(0 0 14px rgba(248,113,113,0.85))"
    : flashing
      ? "drop-shadow(0 0 12px rgba(56,189,248,0.8))"
      : resumed
        ? "drop-shadow(0 0 10px rgba(52,211,153,0.5))"
        : "drop-shadow(0 0 6px rgba(148,163,184,0.35))";
  return (
    <svg
      viewBox="-40 -40 80 80"
      width="96"
      height="96"
      style={{
        filter: glow,
        transition: "filter 400ms ease",
      }}
    >
      <defs>
        <linearGradient id="octo-fraud" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="33%" stopColor="#991b1b" />
          <stop offset="66%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
      </defs>

      {/* Flashing halo */}
      {flashing && (
        <circle
          cx="0"
          cy="0"
          r="30"
          fill="rgba(56,189,248,0.18)"
          style={{
            animation: "none",
          }}
        />
      )}

      {/* Tentacles (8) — arcs around the mantle */}
      {Array.from({ length: 8 }).map((_, k) => {
        const a = (k / 8) * Math.PI * 2;
        const x1 = Math.cos(a) * 6;
        const y1 = Math.sin(a) * 6 + 4;
        const cx = Math.cos(a) * 20;
        const cy = Math.sin(a) * 20 + 6;
        const x2 = Math.cos(a) * 28;
        const y2 = Math.sin(a) * 28 + 8;
        return (
          <path
            key={k}
            d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
            stroke={fraud ? "#b91c1c" : resumed ? "#10b981" : "#64748b"}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />
        );
      })}

      {/* Mantle (body) */}
      <ellipse cx="0" cy="-2" rx="14" ry="12" fill={baseFill} opacity="0.95" />

      {/* Fraud diagonal stripes */}
      {fraud && (
        <g clipPath="url(#octo-clip)">
          <defs>
            <clipPath id="octo-clip">
              <ellipse cx="0" cy="-2" rx="14" ry="12" />
            </clipPath>
          </defs>
          {Array.from({ length: 6 }).map((_, s) => {
            const off = -16 + s * 6;
            return (
              <line
                key={s}
                x1={off}
                y1={-18}
                x2={off + 14}
                y2={14}
                stroke="#450a0a"
                strokeWidth="1.6"
                opacity="0.85"
              />
            );
          })}
        </g>
      )}

      {/* Eyes */}
      <circle cx="-5" cy="-4" r="2.2" fill="white" />
      <circle cx="5" cy="-4" r="2.2" fill="white" />
      <circle
        cx="-5"
        cy="-4"
        r="1.1"
        fill={fraud ? "#7f1d1d" : "black"}
      />
      <circle
        cx="5"
        cy="-4"
        r="1.1"
        fill={fraud ? "#7f1d1d" : "black"}
      />
    </svg>
  );
}
