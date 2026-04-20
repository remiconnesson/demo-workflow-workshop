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
// Variant 22 · Elevator
// Vertical elevator shaft on the left. Floors 94…01 scroll; each floor labels
// a charge summary. Elevator cab slides up/down along the shaft. On fraud,
// cab descends past floor 01 and a hidden floor "QUARANTINE" appears (fades
// in via opacity). Cab stops there, doors slide open (two red panels),
// interior glows red. Kill: cab goes dark. Replay: lights flicker back on,
// cab still at QUARANTINE. Resume: emerald banner.
// ---------------------------------------------------------------------------

const FRAUD_IDX = CHARGES.length - 1;
const STEP_MS = 650;

// Visible floors — top to bottom. Floor numbers match the "94-day" framing:
// we label the top 6 loops numerically + small summaries. Floor "01" is the
// final visible floor; "QUARANTINE" is hidden under it until fraud.
const VISIBLE_FLOORS = [
  { label: "94", note: "• Apple Services" },
  { label: "10", note: "• Uber Trip" },
  { label: "08", note: "• Target" },
  { label: "06", note: "• Starbucks" },
  { label: "04", note: "• Shell Oil" },
  { label: "02", note: "• DoorDash" },
  { label: "01", note: "• Home Depot" },
];
const QUARANTINE_FLOOR = { label: "Q", note: "HIDDEN · QUARANTINE" };

const FLOOR_H = 68; // px each (fixed — CLS)
const SHAFT_TOP_PAD = 28;

export function ElevatorDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 7_500,
    crashHoldMs: 2_400,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const rawTicks = Math.floor(elapsed / STEP_MS);
  const locked = m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;
  // ticks maps 0..FRAUD_IDX over the top floors, then 1 more tick sinks to Q.
  const ticks = locked ? FRAUD_IDX + 1 : Math.min(rawTicks, FRAUD_IDX + 1);
  const atQuarantine = ticks >= FRAUD_IDX;

  const scanned = 42_804_192 + Math.min(ticks, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  // Cab Y position — fixed mapping so no reflow. Cab travels down across
  // visible floors as ticks increase, stops at quarantine on fraud.
  const visibleIndex = Math.min(ticks, VISIBLE_FLOORS.length - 1); // 0..6
  const normalY = SHAFT_TOP_PAD + visibleIndex * FLOOR_H;
  const quarantineY = SHAFT_TOP_PAD + VISIBLE_FLOORS.length * FLOOR_H;
  const cabY = atQuarantine ? quarantineY : normalY;

  const doorsOpen = atQuarantine && (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed);
  const lightsOff = m.isCrashed;

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "descend(floors: 94 → 01)" });
    out.push({ kind: "RUN", msg: `atFloor(${VISIBLE_FLOORS[Math.min(visibleIndex, VISIBLE_FLOORS.length - 1)].label})` });
    if (atQuarantine) {
      out.push({ kind: "CMP", msg: `openHiddenFloor(Q · ${FRAUD_CARD})` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed) out.push({ kind: "ERR", msg: "power loss · cab dark" });
    if (m.isReplaying) out.push({ kind: "RPL", msg: "lights flicker · cab cached at Q" });
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, visibleIndex, atQuarantine, m.isCrashed, m.isReplaying, m.isResumed]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Elevator · tower 94"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        {/* scope labels */}
        <div className="pointer-events-none absolute top-6 right-8 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            cab location
          </span>
          <span
            className={`font-mono text-3xl tabular-nums transition-colors duration-300 ${
              atQuarantine ? "text-red-300" : "text-sky-300"
            }`}
          >
            {atQuarantine
              ? "Q · QUARANTINE"
              : VISIBLE_FLOORS[visibleIndex]?.label ?? "—"}
          </span>
        </div>

        <div className="flex h-full w-full">
          {/* LEFT: shaft */}
          <div
            className="relative shrink-0"
            style={{ width: "460px" }}
          >
            {/* shaft background */}
            <div
              className="absolute top-6 bottom-6 left-24 w-56 rounded-xl border border-white/10 bg-black"
              style={{
                boxShadow: "inset 0 0 60px rgba(0,0,0,0.9)",
                background:
                  "linear-gradient(180deg, rgba(12,12,14,1) 0%, rgba(6,6,8,1) 100%)",
              }}
            />

            {/* floor markers — fixed positions, no reflow */}
            <div className="absolute top-6 left-24 w-56">
              {VISIBLE_FLOORS.map((f, i) => {
                const y = SHAFT_TOP_PAD + i * FLOOR_H;
                const passed = ticks > i;
                return (
                  <div
                    key={f.label}
                    className="absolute left-0 right-0 flex items-center"
                    style={{ top: `${y}px`, height: `${FLOOR_H}px` }}
                  >
                    <div className="flex w-full items-center gap-3 border-t border-white/5 px-3">
                      <span
                        className={`font-mono text-lg font-semibold tabular-nums transition-colors duration-300 ${
                          passed ? "text-zinc-500" : "text-zinc-300"
                        }`}
                      >
                        {f.label}
                      </span>
                      <span className="truncate font-mono text-xs text-zinc-600">
                        {f.note}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* QUARANTINE hidden floor — pre-rendered, opacity only */}
              <div
                className="absolute left-0 right-0 flex items-center transition-opacity duration-700"
                style={{
                  top: `${quarantineY}px`,
                  height: `${FLOOR_H}px`,
                  opacity: atQuarantine ? 1 : 0,
                }}
              >
                <div className="flex w-full items-center gap-3 border-t border-red-500/40 bg-red-500/5 px-3">
                  <span className="font-mono text-lg font-bold uppercase tabular-nums text-red-300">
                    {QUARANTINE_FLOOR.label}
                  </span>
                  <span className="truncate font-mono text-xs uppercase tracking-[0.12em] text-red-300/80">
                    {QUARANTINE_FLOOR.note}
                  </span>
                </div>
              </div>
            </div>

            {/* cab — translates along the shaft */}
            <div
              className="absolute left-24 w-56"
              style={{
                top: "24px",
                height: `${FLOOR_H}px`,
                transform: `translateY(${cabY - 24}px)`,
                transition: "transform 600ms cubic-bezier(.2,.8,.2,1)",
              }}
            >
              <div
                className={`relative mx-2 h-full rounded-lg border-2 transition-colors duration-500 ${
                  doorsOpen ? "border-red-500/70" : "border-zinc-600"
                }`}
                style={{
                  background: lightsOff
                    ? "rgb(4,4,6)"
                    : doorsOpen
                      ? "radial-gradient(ellipse at 50% 50%, rgba(127,29,29,0.55) 0%, rgba(30,6,6,0.95) 70%)"
                      : "linear-gradient(180deg, rgb(40,42,48) 0%, rgb(22,24,28) 100%)",
                  boxShadow: doorsOpen
                    ? "0 0 40px rgba(248,113,113,0.55), inset 0 0 24px rgba(248,113,113,0.55)"
                    : lightsOff
                      ? "none"
                      : "0 0 20px rgba(0,0,0,0.8), inset 0 0 10px rgba(255,255,255,0.06)",
                }}
              >
                {/* roof */}
                <div className="absolute left-0 right-0 top-0 h-1.5 rounded-t-lg bg-zinc-700" />

                {/* doors — two panels that slide outward when open */}
                <div
                  className="absolute left-0 top-2 bottom-2 w-[48%] rounded-l-md border-r border-black/40"
                  style={{
                    background: lightsOff
                      ? "rgb(10,10,12)"
                      : doorsOpen
                        ? "linear-gradient(90deg, rgb(127,29,29) 0%, rgb(60,10,10) 100%)"
                        : "linear-gradient(90deg, rgb(70,72,78) 0%, rgb(40,42,48) 100%)",
                    transform: doorsOpen ? "translateX(-60%)" : "translateX(0)",
                    transition: "transform 700ms cubic-bezier(.2,.8,.2,1), background 400ms ease",
                  }}
                />
                <div
                  className="absolute right-0 top-2 bottom-2 w-[48%] rounded-r-md border-l border-black/40"
                  style={{
                    background: lightsOff
                      ? "rgb(10,10,12)"
                      : doorsOpen
                        ? "linear-gradient(270deg, rgb(127,29,29) 0%, rgb(60,10,10) 100%)"
                        : "linear-gradient(270deg, rgb(70,72,78) 0%, rgb(40,42,48) 100%)",
                    transform: doorsOpen ? "translateX(60%)" : "translateX(0)",
                    transition: "transform 700ms cubic-bezier(.2,.8,.2,1), background 400ms ease",
                  }}
                />

                {/* inside glow label visible when doors open */}
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-500"
                  style={{ opacity: doorsOpen && !lightsOff ? 1 : 0 }}
                >
                  <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-red-200">
                    {FRAUD_CARD}
                  </span>
                </div>

                {/* flicker overlay when replaying */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-lg"
                  style={{
                    background: "rgba(125,211,252,0.22)",
                    opacity: m.isReplaying ? 1 : 0,
                    animation: m.isReplaying ? "elevFlicker 600ms linear infinite" : undefined,
                    transition: "opacity 200ms ease",
                  }}
                />
              </div>
            </div>

            {/* cable */}
            <div
              className="absolute left-1/2 top-0 w-[2px] -translate-x-1/2 bg-zinc-700/60"
              style={{ height: `${cabY + 24}px`, transition: "height 600ms cubic-bezier(.2,.8,.2,1)" }}
            />

            <style>{`
              @keyframes elevFlicker {
                0%, 100% { opacity: 0.6; }
                50%      { opacity: 0.1; }
              }
            `}</style>
          </div>

          {/* RIGHT: panel */}
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
            <div className="flex flex-col items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-[0.22em] text-zinc-500">
                current charge
              </span>
              <span
                className={`font-mono text-4xl tabular-nums transition-colors duration-300 ${
                  atQuarantine ? "text-red-300" : "text-zinc-100"
                }`}
              >
                {(CHARGES[Math.min(ticks, CHARGES.length - 1)] ?? CHARGES[0]).amount}
              </span>
              <span className="font-mono text-sm text-zinc-400">
                {(CHARGES[Math.min(ticks, CHARGES.length - 1)] ?? CHARGES[0]).merchant}
              </span>
            </div>

            {/* floor indicator row */}
            <div className="flex items-center gap-2">
              {[...VISIBLE_FLOORS, QUARANTINE_FLOOR].map((f, i) => {
                const isQ = i === VISIBLE_FLOORS.length;
                const reached = isQ ? atQuarantine : ticks > i;
                const highlighted = isQ ? atQuarantine : visibleIndex === i && !atQuarantine;
                return (
                  <div
                    key={f.label}
                    className={`h-2 w-8 rounded-full transition-all duration-300 ${
                      isQ && highlighted
                        ? "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.8)]"
                        : highlighted
                          ? "bg-sky-400 shadow-[0_0_10px_rgba(125,211,252,0.6)]"
                          : reached
                            ? "bg-emerald-400/60"
                            : "bg-white/10"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Power loss · cab frozen at Q"
          footer="Event log intact · hidden floor held"
        />
        <ReplayingChip active={m.isReplaying} />
        <IdleHint
          eyebrow="fraud sentinel · always on"
          purpose="94 floors · one hidden."
          active={!m.active}
        />
      </div>

      <ResumedBanner
        active={m.isResumed}
        headline="94 floors · 0 skipped · 1 hidden quarantine held."
        stat={`${FRAUD_CARD} · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
