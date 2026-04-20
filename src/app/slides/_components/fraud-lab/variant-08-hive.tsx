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
// Variant 08 · Bee hive
// Hex grid of merchants. Green hexes = visited-in-94-days merchants. One
// dark hex — CRYPTONOME-XYZ — has never been visited. Bees stream from the
// "card feed" into merchant hexes as charges clear. On fraud, a bee flies
// into the dark hex; it flashes red; every bee freezes; a swarm of red bees
// converges. Hex burns red "FROZEN". Crash freezes all bees; replay unfreezes
// from exact cached positions; resume leaves the red hex permanent.
// ---------------------------------------------------------------------------

const FRAUD_IDX = CHARGES.length - 1;

// 7 columns × 6 rows honeycomb (offset odd rows)
const COLS = 7;
const ROWS = 6;

type Hex = {
  col: number;
  row: number;
  label: string;
  isFraud: boolean;
  cx: number; // percent
  cy: number; // percent
};

const MERCHANT_LABELS = [
  "APPLE", "UBER", "TARGET", "STARBUCKS", "SHELL", "DOORDASH", "NETFLIX",
  "AMAZON", "HOME DEPOT", "COSTCO", "WALMART", "CHIPOTLE", "SPOTIFY", "DELTA",
  "TRADER JOE", "CVS", "WHOLE FOODS", "LYFT", "BEST BUY", "IKEA",
  "PEET'S", "SAFEWAY", "LOWES", "KROGER", "UNITED", "NORDSTROM",
  "MCDONALD'S", "SHAKE SHACK", "PANERA", "SEPHORA", "WALGREENS", "AIRBNB",
  "GAP", "NIKE", "YOUTUBE", "DROPBOX", "MICROSOFT", "AT&T",
  "VERIZON", "DISNEY", "HULU",
];

// Build the grid. Fraud hex is placed roughly in the middle-right.
const HEX_ROW_OFFSET = 50 / ROWS; // vertical percent per row
const HEX_COL_OFFSET = 100 / (COLS + 0.5);
const FRAUD_CELL = { col: 4, row: 2 };

const HEXES: Hex[] = (() => {
  const out: Hex[] = [];
  let m = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const isFraud = col === FRAUD_CELL.col && row === FRAUD_CELL.row;
      const label = isFraud ? "CRYPTONOME-XYZ" : MERCHANT_LABELS[m % MERCHANT_LABELS.length];
      if (!isFraud) m += 1;
      const oddOffset = row % 2 === 1 ? HEX_COL_OFFSET / 2 : 0;
      const cx = 8 + col * HEX_COL_OFFSET + oddOffset;
      const cy = 12 + row * HEX_ROW_OFFSET * 1.55;
      out.push({ col, row, label, isFraud, cx, cy });
    }
  }
  return out;
})();

const FRAUD_HEX = HEXES.find((h) => h.isFraud)!;

// Which non-fraud hex each charge animates toward (picked by index)
const CHARGE_TARGETS: number[] = CHARGES.map((_, i) => {
  // pick a non-fraud hex deterministically
  const candidates = HEXES.filter((h) => !h.isFraud);
  return HEXES.indexOf(candidates[(i * 7 + 3) % candidates.length]);
});

const BEE_INTERVAL_MS = 500;

export function HiveDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_000,
    crashHoldMs: 2_200,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const driftIdx = Math.min(Math.floor(elapsed / BEE_INTERVAL_MS), FRAUD_IDX);
  const pauseOnFraud =
    m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;

  const scanned = 42_804_192 + Math.min(driftIdx, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  // "Visited" hex count — greens light up as charges land
  const visitedHexes = new Set<number>();
  for (let i = 0; i < Math.min(driftIdx, FRAUD_IDX); i++) {
    visitedHexes.add(CHARGE_TARGETS[i]);
  }

  // Bees — 10 generic live bees bouncing to different hexes + fraud bee
  const liveBeeIdx = Math.min(driftIdx, FRAUD_IDX - 1);
  const activeBeeTargets = Array.from({ length: 4 }, (_, i) => {
    const idx = Math.max(0, liveBeeIdx - i);
    return CHARGE_TARGETS[idx];
  });

  // Red swarm bees — converge on fraud hex from around it
  const swarm = useMemo(() => {
    const out: { cx: number; cy: number }[] = [];
    HEXES.forEach((h) => {
      if (h.isFraud) return;
      const dx = h.cx - FRAUD_HEX.cx;
      const dy = h.cy - FRAUD_HEX.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 28) out.push({ cx: h.cx, cy: h.cy });
    });
    return out.slice(0, 20);
  }, []);

  const showFraudBee = pauseOnFraud;
  const showSwarm = m.isCrashed || m.isReplaying || m.isResumed;
  // "Bees paused" — during crashed only; during armed, only the fraud bee has landed
  const beesPaused = m.isCrashed || m.isReplaying;

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    if (driftIdx > 0) {
      out.push({ kind: "RUN", msg: `scoreRisk(batch: ${driftIdx} cleared)` });
    }
    if (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "hive dark · process killed" });
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

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Hive · merchant grid"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        {/* card feed origin indicator (left edge) */}
        <div className="pointer-events-none absolute top-1/2 left-6 -translate-y-1/2 flex flex-col items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            feed
          </span>
          <div
            className={`h-3 w-3 rounded-full transition-colors duration-300 ${
              m.isCrashed ? "bg-red-500/50" : "bg-emerald-400 animate-pulse"
            }`}
          />
        </div>

        {/* Hex grid (SVG) */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${
            m.isCrashed ? "opacity-30" : "opacity-100"
          }`}
        >
          {HEXES.map((h, i) => {
            const visited = visitedHexes.has(i);
            const isFraudHit = h.isFraud && pauseOnFraud;
            const stroke = isFraudHit
              ? "rgb(248,113,113)"
              : visited
                ? "rgba(74,222,128,0.7)"
                : h.isFraud
                  ? "rgba(63,63,70,1)"
                  : "rgba(255,255,255,0.08)";
            const fill = isFraudHit
              ? "rgba(248,113,113,0.18)"
              : visited
                ? "rgba(16,185,129,0.06)"
                : h.isFraud
                  ? "rgba(0,0,0,0.65)"
                  : "rgba(255,255,255,0.02)";
            return (
              <g key={i}>
                <polygon
                  points={hexPoints(h.cx, h.cy, 6.4)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isFraudHit ? 0.7 : 0.25}
                  style={{
                    transition: "fill 400ms ease, stroke 400ms ease",
                    filter: isFraudHit
                      ? "drop-shadow(0 0 3px rgba(248,113,113,0.7))"
                      : visited
                        ? "drop-shadow(0 0 1.5px rgba(74,222,128,0.3))"
                        : "none",
                  }}
                />
                <text
                  x={h.cx}
                  y={h.cy + 0.6}
                  textAnchor="middle"
                  fontSize="1.4"
                  fontFamily="ui-monospace, Menlo, monospace"
                  fill={
                    isFraudHit
                      ? "rgb(254,202,202)"
                      : h.isFraud
                        ? "rgba(161,161,170,0.7)"
                        : visited
                          ? "rgba(187,247,208,0.8)"
                          : "rgba(161,161,170,0.5)"
                  }
                  style={{ transition: "fill 400ms ease" }}
                >
                  {h.label.length > 10 ? `${h.label.slice(0, 10)}…` : h.label}
                </text>
              </g>
            );
          })}

          {/* live bees — tiny dots flying from left */}
          {!showSwarm && m.active && activeBeeTargets.map((tgtIdx, i) => {
            const tgt = HEXES[tgtIdx];
            const wobble = (Math.sin((elapsed + i * 300) / 220) + 1) / 2;
            const progress = beesPaused ? 1 : ((elapsed / 400 + i * 0.25) % 1);
            const bx = 2 + (tgt.cx - 2) * progress;
            const by = 50 + (tgt.cy - 50) * progress + (wobble - 0.5) * 2;
            return (
              <circle
                key={`bee-${i}`}
                cx={bx}
                cy={by}
                r="0.55"
                fill="rgb(251,191,36)"
                opacity={m.isArmed ? 0.3 : 0.9}
                style={{
                  filter: "drop-shadow(0 0 1.5px rgba(251,191,36,0.8))",
                  transition: "opacity 300ms ease",
                }}
              />
            );
          })}

          {/* fraud bee — flies from card feed into CRYPTONOME hex */}
          <circle
            cx={showFraudBee ? FRAUD_HEX.cx : 2}
            cy={showFraudBee ? FRAUD_HEX.cy : 50}
            r="0.7"
            fill="rgb(248,113,113)"
            opacity={m.isArmed || m.isCrashed || m.isReplaying || m.isResumed ? 1 : 0}
            style={{
              filter: "drop-shadow(0 0 2px rgba(248,113,113,0.9))",
              transition: "cx 500ms ease-out, cy 500ms ease-out, opacity 300ms ease",
            }}
          />

          {/* red swarm converging on fraud hex */}
          {swarm.map((s, i) => {
            const t = showSwarm ? 1 : 0;
            const cx = s.cx + (FRAUD_HEX.cx - s.cx) * t;
            const cy = s.cy + (FRAUD_HEX.cy - s.cy) * t;
            return (
              <circle
                key={`sw-${i}`}
                cx={cx}
                cy={cy}
                r="0.55"
                fill="rgb(248,113,113)"
                opacity={showSwarm ? 0.9 : 0}
                style={{
                  transition: `cx 900ms ease ${i * 30}ms, cy 900ms ease ${i * 30}ms, opacity 300ms ease`,
                  filter: "drop-shadow(0 0 1.5px rgba(248,113,113,0.8))",
                }}
              />
            );
          })}

          {/* FROZEN label near fraud hex */}
          {pauseOnFraud && (
            <text
              x={FRAUD_HEX.cx}
              y={FRAUD_HEX.cy + 3.6}
              textAnchor="middle"
              fontSize="1.3"
              fontFamily="ui-monospace, Menlo, monospace"
              fontWeight="700"
              fill="rgb(248,113,113)"
              style={{ letterSpacing: "0.15em" }}
            >
              FROZEN
            </text>
          )}
        </svg>

        {/* current charge readout */}
        <div className="pointer-events-none absolute top-6 left-8 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            current charge
          </span>
          <span
            className={`font-mono text-2xl tabular-nums transition-colors duration-300 ${
              pauseOnFraud ? "text-red-300" : "text-emerald-300"
            }`}
          >
            {pauseOnFraud
              ? `${FRAUD_CARD} · ${FRAUD_MERCHANT}`
              : `${CHARGES[Math.min(driftIdx, FRAUD_IDX - 1)].card} · ${CHARGES[Math.min(driftIdx, FRAUD_IDX - 1)].merchant}`}
          </span>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Hive dark · process killed"
          footer="Bees cached · positions intact"
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
        headline="Hive intact."
        stat={`${FRAUD_CARD} frozen · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}

// ---- helpers --------------------------------------------------------------

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}
