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
// Variant 13 · Long scroll with AI interruptions
// Typewriter-style charge log scrolls upward at a steady pace. Every ~20 rows
// the scroll HALTS, screen dims, and a bold sentinel message appears center.
// On fraud, the interruption says "Wait. 8891 doesn't fit. Freezing it." Crash
// stops the scroll entirely with a short sentinel voice pair. Resume restarts.
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 42;     // px per row
const ROW_PERIOD_MS = 250; // ms per row of scroll
const FRAUD_IDX = CHARGES.length - 1;

// Build a long, deterministic ledger — repeat CHARGES with slight time mutations
// and end with the fraud row.
type LogRow = {
  time: string;
  card: string;
  merchant: string;
  amount: string;
  country: string;
  verdict: "clear" | "frozen";
  isFraud: boolean;
};

function buildRows(): LogRow[] {
  const rows: LogRow[] = [];
  for (let loop = 0; loop < 4; loop++) {
    for (let i = 0; i < CHARGES.length - 1; i++) {
      const c = CHARGES[i];
      const sec = (parseInt(c.time.split(":").pop() ?? "0", 10) + loop * 3) % 60;
      const time = `${c.time.slice(0, 6)}${sec.toString().padStart(2, "0")}`;
      rows.push({
        time,
        card: c.card,
        merchant: c.merchant,
        amount: c.amount,
        country: c.country,
        verdict: "clear",
        isFraud: false,
      });
    }
  }
  const fraud = CHARGES[FRAUD_IDX];
  rows.push({
    time: fraud.time,
    card: fraud.card,
    merchant: fraud.merchant,
    amount: fraud.amount,
    country: fraud.country,
    verdict: "frozen",
    isFraud: true,
  });
  return rows;
}

const ROWS = buildRows();
const FRAUD_ROW_INDEX = ROWS.length - 1;

// Background interrupt checkpoints — row indexes where the sentinel pipes up
const INTERRUPT_BG_AT = [20, 42];
const INTERRUPT_DURATION_MS = 2_400;

type InterruptKind = "bg" | "fraud" | "crash";
type InterruptState = {
  kind: InterruptKind;
  message: string;
  signature: string;
  active: boolean;
};

export function ScrollDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_500,
    crashHoldMs: 2_400,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  // Current row index (paused at fraud row once armed)
  const currentRow = m.active
    ? m.isArmed || m.isCrashed || m.isReplaying || m.isResumed
      ? FRAUD_ROW_INDEX
      : Math.min(Math.floor(elapsed / ROW_PERIOD_MS), FRAUD_ROW_INDEX - 2)
    : 0;

  // Determine interrupt: we align background interrupts to specific row numbers;
  // each interrupt lasts INTERRUPT_DURATION_MS once reached.
  const rowReachedMs = currentRow * ROW_PERIOD_MS;
  const sinceRowReached = elapsed - rowReachedMs;

  let interrupt: InterruptState = {
    kind: "bg",
    message: "",
    signature: "",
    active: false,
  };

  if (m.isCrashed) {
    interrupt = {
      kind: "crash",
      message: '"I\'ve stopped. Catch me up."',
      signature: "Sentinel",
      active: true,
    };
  } else if (m.isReplaying) {
    interrupt = {
      kind: "crash",
      message: '"Caught. 0 re-executions."',
      signature: "Sentinel",
      active: true,
    };
  } else if (m.isArmed) {
    interrupt = {
      kind: "fraud",
      message: `"Wait. ${FRAUD_CARD.replace("•••• ", "")} doesn't fit. Freezing it. Explain later."`,
      signature: "Sentinel",
      active: true,
    };
  } else if (
    INTERRUPT_BG_AT.includes(currentRow) &&
    sinceRowReached < INTERRUPT_DURATION_MS
  ) {
    const idx = INTERRUPT_BG_AT.indexOf(currentRow);
    interrupt = {
      kind: "bg",
      message:
        idx === 0
          ? '"Last block: 20 clean. I\'m watching."'
          : '"Still nothing. 22 more clean."',
      signature: "Sentinel, 94d",
      active: true,
    };
  } else if (currentRow === FRAUD_ROW_INDEX && !m.isArmed) {
    // fraud row reached before arm — hold on a visible "scoring" state
    interrupt = {
      kind: "bg",
      message: "",
      signature: "",
      active: false,
    };
  }

  const paused = interrupt.active || m.isCrashed;
  const scrollY = paused
    ? currentRow * ROW_HEIGHT
    : Math.min(
        (elapsed / ROW_PERIOD_MS) * ROW_HEIGHT,
        (FRAUD_ROW_INDEX - 2) * ROW_HEIGHT,
      );

  const scanned = 42_804_192 + Math.min(currentRow, 60) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    if (currentRow > 0) {
      out.push({ kind: "RUN", msg: `scoreRisk(batch: ${currentRow})` });
    }
    if (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "scroll halted · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying scroll" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, currentRow, m.isArmed, m.isCrashed, m.isReplaying, m.isResumed]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Scroll · live ledger"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        {/* Fade masks */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-zinc-950 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-zinc-950 to-transparent" />

        {/* The column — 70% width centered, scrolls up via translateY */}
        <div className="relative flex h-full w-full items-start justify-center overflow-hidden">
          <div
            className="relative w-[70%] max-w-[900px] pt-[40%]"
            style={{
              transform: `translateY(-${scrollY}px)`,
              transition: paused ? "transform 500ms ease-out" : "transform 250ms linear",
            }}
          >
            {ROWS.map((r, i) => {
              // Only render rows within a reasonable window around currentRow
              // to keep DOM light; we render all because ~45 rows is fine.
              const highlighted = i === FRAUD_ROW_INDEX && (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed);
              const isCurrent = i === currentRow;
              return (
                <div
                  key={i}
                  className={`grid grid-cols-[100px_110px_1fr_100px_40px_100px] gap-5 border-b border-white/5 px-2 font-mono text-lg tabular-nums transition-colors duration-300 ${
                    highlighted
                      ? "text-red-300"
                      : isCurrent
                        ? "text-white"
                        : "text-zinc-500"
                  }`}
                  style={{ height: ROW_HEIGHT, lineHeight: `${ROW_HEIGHT}px` }}
                >
                  <span>{r.time}</span>
                  <span>{r.card}</span>
                  <span className="truncate">{r.merchant}</span>
                  <span className="text-right">{r.amount}</span>
                  <span
                    className={`text-center ${
                      r.country !== "US" ? "text-red-400" : ""
                    }`}
                  >
                    {r.country}
                  </span>
                  <span
                    className={`${
                      highlighted
                        ? "text-red-400"
                        : "text-emerald-400/60"
                    }`}
                  >
                    · {highlighted ? "FROZEN" : "clear"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dimming overlay + interrupt message */}
        <div
          className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/75 transition-opacity duration-500 ${
            interrupt.active ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="max-w-3xl px-8 text-center">
            <p
              className={`text-4xl font-semibold tracking-tight transition-colors duration-300 ${
                interrupt.kind === "fraud"
                  ? "text-red-200"
                  : interrupt.kind === "crash"
                    ? "text-zinc-300"
                    : "text-white"
              }`}
            >
              {interrupt.message || "\u00A0"}
            </p>
            <p className="mt-3 font-mono text-sm uppercase tracking-[0.3em] text-zinc-500">
              {interrupt.signature || "\u00A0"}
            </p>
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Scroll halted · process killed"
          footer="Event log intact · last row cached"
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
