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
// Variant 17 · Jacquard loom
// A 94-col × 20-row tapestry woven top-down. Each frame, a new stitch
// advances down the latest column (deterministic green/amber from risk).
// The final column stitches RED at the flagged charge and pulses. On kill,
// weaving halts mid-stitch with a glowing cursor. Replay completes cached
// stitches. Resume: emerald "1,248 red threads · woven through one crash."
// ---------------------------------------------------------------------------

const COLS = 94;
const ROWS = 20;
const TICK_MS = 80;              // per-stitch
const FRAUD_COL = COLS - 1;      // last column is the fraud

// Deterministic pseudo-color per column (green dominated, amber outliers)
function threadColor(col: number): "green" | "amber" {
  // Known amber columns from a fixed sine pattern.
  const v = Math.sin(col * 12.9898) * 43758.5453;
  const f = v - Math.floor(v);
  return f > 0.82 ? "amber" : "green";
}

export function LoomDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 7_500,
    crashHoldMs: 2_400,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  // Total stitches laid = elapsed / TICK_MS, cap at full cloth.
  const totalCells = COLS * ROWS;
  const liveStitches = Math.min(Math.floor(elapsed / TICK_MS), totalCells);

  const frozenAtFraud =
    m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;

  // When fraud phase begins we pin to the red-stitch row in FRAUD_COL.
  // Partially-woven cursor lives in FRAUD_COL at (about) row 12 during crash.
  const cursorRow = 12;
  const stitchCount = frozenAtFraud ? (FRAUD_COL * ROWS) + cursorRow : liveStitches;

  const scanned = 42_804_192 + Math.floor(elapsed / 700) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  // Determine whether a particular (col, row) stitch is woven yet.
  const isWoven = (col: number, row: number): boolean => {
    const idx = col * ROWS + row;
    if (m.isReplaying || m.isResumed) {
      // After replay, the whole fraud column is woven through row 19.
      return idx <= FRAUD_COL * ROWS + ROWS - 1;
    }
    return idx < stitchCount;
  };

  // Fraud column cursor visibility for live/armed/crashed — fades in
  // once we've reached the fraud column, stays during crash, fades out after.
  const cursorVisible =
    frozenAtFraud && !m.isReplaying && !m.isResumed;

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    out.push({ kind: "RUN", msg: "loom.weave(cols: 94, rows: 20)" });
    if (frozenAtFraud) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "shuttle halted · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying cached threads" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 1 red thread added" });
    }
    return out;
  }, [m.phase, m.isCrashed, m.isReplaying, m.isResumed, frozenAtFraud]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Jacquard loom · 94 columns"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black">
        {/* Legend */}
        <div className="pointer-events-none absolute top-6 right-8 flex flex-col items-end gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            legend
          </span>
          <div className="flex flex-col gap-1.5 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-emerald-400/80" />
              <span className="text-zinc-300">cleared</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-amber-300/80" />
              <span className="text-zinc-300">review</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-red-500/85" />
              <span className="text-zinc-300">fraud</span>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute top-6 left-8 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            weave
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
              ? "SHUTTLE HALTED"
              : m.isResumed
                ? "COMPLETE · 1,880 stitches"
                : m.active
                  ? `col ${Math.min(Math.floor(liveStitches / ROWS) + 1, COLS)} / ${COLS}`
                  : "ready"}
          </span>
        </div>

        {/* Tapestry grid */}
        <div className="absolute inset-0 flex items-center justify-center px-8 pt-24 pb-28">
          <svg
            viewBox={`0 0 ${COLS * 2} ${ROWS * 4}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full"
            style={{
              filter: m.isCrashed ? "brightness(0.45)" : "none",
              transition: "filter 400ms ease",
            }}
          >
            <defs>
              <linearGradient id="warp-bg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0a0a0a" />
                <stop offset="100%" stopColor="#000000" />
              </linearGradient>
            </defs>

            <rect x="0" y="0" width={COLS * 2} height={ROWS * 4} fill="url(#warp-bg)" />

            {/* Vertical warp guides */}
            {Array.from({ length: COLS }).map((_, col) => (
              <line
                key={`warp-${col}`}
                x1={col * 2 + 1}
                x2={col * 2 + 1}
                y1={0}
                y2={ROWS * 4}
                stroke="rgb(255 255 255 / 0.04)"
                strokeWidth="0.15"
              />
            ))}

            {/* Stitches */}
            {Array.from({ length: COLS }).map((_, col) =>
              Array.from({ length: ROWS }).map((_, row) => {
                const woven = isWoven(col, row);
                const isFraud = col === FRAUD_COL;
                const color = isFraud
                  ? "#ef4444"
                  : threadColor(col) === "amber"
                    ? "#fcd34d"
                    : "#34d399";
                // Fraud column row opacity during crash: only stitches above the cursor row.
                let opacity = woven ? 0.92 : 0;
                if (isFraud && m.isCrashed && row >= cursorRow) opacity = 0;
                return (
                  <rect
                    key={`${col}-${row}`}
                    x={col * 2 + 0.2}
                    y={row * 4 + 0.3}
                    width={1.6}
                    height={3.4}
                    fill={color}
                    opacity={opacity}
                    style={{
                      transition: "opacity 450ms ease",
                    }}
                  />
                );
              }),
            )}

            {/* Fraud column red thread outline pulse */}
            {frozenAtFraud && (
              <rect
                x={FRAUD_COL * 2 - 0.3}
                y={-0.2}
                width={2.6}
                height={ROWS * 4 + 0.4}
                fill="none"
                stroke="#ef4444"
                strokeWidth="0.35"
                opacity="0.75"
                style={{
                  filter: "drop-shadow(0 0 1.2px rgba(248,113,113,0.8))",
                }}
              >
                <animate
                  attributeName="stroke-opacity"
                  values="0.4;0.95;0.4"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              </rect>
            )}

            {/* Glowing cursor on fraud column (crashed / armed) */}
            <g
              style={{
                opacity: cursorVisible ? 1 : 0,
                transition: "opacity 300ms ease",
              }}
            >
              <rect
                x={FRAUD_COL * 2 - 0.1}
                y={cursorRow * 4 - 0.2}
                width={2.2}
                height={0.9}
                fill="#f87171"
                style={{
                  filter: "drop-shadow(0 0 1.6px rgba(248,113,113,0.95))",
                }}
              >
                <animate
                  attributeName="opacity"
                  values="0.6;1;0.6"
                  dur="0.9s"
                  repeatCount="indefinite"
                />
              </rect>
            </g>
          </svg>
        </div>

        {/* Bottom status strip */}
        <div
          className={`pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${
            frozenAtFraud && !m.isCrashed ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="rounded-xl border border-red-500/60 bg-black/85 px-6 py-2 font-mono text-sm text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.35)]">
            RED THREAD · {FRAUD_CARD} · {FRAUD_MERCHANT}
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Shuttle halted · process killed"
          footer="Event log intact · threads cached"
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
        headline="94 days · 1,248 red threads"
        stat={`woven through one crash · ${FRAUD_CARD} frozen`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
