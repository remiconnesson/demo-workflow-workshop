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
// Variant 05 · Conveyor arm
// Factory side-view. A belt scrolls cards left→right. A robot arm descends
// with a rotating stamp head. Normal path: arm descends, thud green, card
// moves on. Fraud: arm descends halfway, pauses, reasoning bubble streams
// beside the joint, stamp rotates to red, slams. Crash: arm freezes
// mid-rotation, cards unsealed. Replay: arm finishes rotation from stuck
// angle. Resume: red stamp lands, "cached: already frozen" chip above.
// ---------------------------------------------------------------------------

const BELT_SPEED = 180; // px per second baseline
const CARD_W = 140;
const CARD_GAP = 80;
const SLOT = CARD_W + CARD_GAP;
const FRAUD_IDX = CHARGES.length - 1;

type ArmStage =
  | "resting"
  | "descending"
  | "stamping"
  | "rising"
  | "hesitating"
  | "rotating"
  | "slamming"
  | "frozen-mid"
  | "resuming-rotation"
  | "cached-slam";

export function ConveyorDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_500,
    crashHoldMs: 2_400,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  // Belt offset (for striped pattern + card positions)
  // Cards travel in from right; card i's center is at: stampX - (elapsed*speed - i*SLOT)
  // Stop belt when we reach fraud card (pauseAtFraud).
  const pauseAtFraud = m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;
  const travel = pauseAtFraud
    ? FRAUD_IDX * SLOT
    : (elapsed / 1000) * BELT_SPEED;

  const currentIdx = Math.min(Math.floor(travel / SLOT), CHARGES.length - 1);
  const progressInSlot = (travel % SLOT) / SLOT;

  const scanned = 42_804_192 + Math.min(currentIdx, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  // Arm stage, blends based on phase
  const armStage: ArmStage = m.isCrashed
    ? "frozen-mid"
    : m.isReplaying
      ? "resuming-rotation"
      : m.isResumed
        ? "cached-slam"
        : m.isArmed
          ? // cycle: hesitating -> rotating -> slamming
            progressInSlot < 0.3
            ? "hesitating"
            : progressInSlot < 0.6
              ? "rotating"
              : "slamming"
          : // normal cycle: descend -> stamp -> rise based on slot progress
            progressInSlot < 0.35
            ? "descending"
            : progressInSlot < 0.55
              ? "stamping"
              : "rising";

  // Arm vertical offset (0 = up, 100 = down)
  const armY = (() => {
    switch (armStage) {
      case "descending":
        return progressInSlot * 260;
      case "stamping":
        return 95;
      case "rising":
        return 95 - (progressInSlot - 0.55) * 220;
      case "hesitating":
        return 45;
      case "rotating":
        return 55;
      case "slamming":
        return 95;
      case "frozen-mid":
        return 60;
      case "resuming-rotation":
        return 75;
      case "cached-slam":
        return 95;
      default:
        return 0;
    }
  })();

  // Stamp head rotation: 0 = green up, 180 = red up
  const stampRot = (() => {
    switch (armStage) {
      case "hesitating":
        return 40;
      case "rotating":
        return 110;
      case "slamming":
      case "cached-slam":
        return 180;
      case "frozen-mid":
        return 95; // stuck
      case "resuming-rotation":
        return 180 * Math.min(1, (elapsed % 1800) / 1800);
      default:
        return 0;
    }
  })();

  // Belt stripe scroll offset
  const stripeOffset = pauseAtFraud
    ? -FRAUD_IDX * SLOT
    : -travel;

  const reasoningText =
    "evaluate · RU merchant · 3x typical · midday · 0 priors · score=0.93";
  const reasoningLen =
    armStage === "hesitating"
      ? Math.floor((progressInSlot / 0.3) * reasoningText.length)
      : armStage === "rotating" || armStage === "slamming" || armStage === "cached-slam"
        ? reasoningText.length
        : armStage === "frozen-mid" || armStage === "resuming-rotation"
          ? reasoningText.length
          : 0;

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "beltScan · descend · stamp · rise" });
    if (currentIdx > 0) {
      out.push({
        kind: "RUN",
        msg: `stamp(batch: ${Math.min(currentIdx, FRAUD_IDX)} cleared)`,
      });
    }
    if (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `arm pauses · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "power lost · arm frozen mid-rotation" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying arm trajectory" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, currentIdx, m.isArmed, m.isCrashed, m.isReplaying, m.isResumed]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Conveyor arm"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        {/* factory header */}
        <div className="pointer-events-none absolute top-6 left-8">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            line 04 · stamp station
          </span>
        </div>
        <div className="pointer-events-none absolute top-6 right-8">
          <span
            className={`font-mono text-[11px] uppercase tracking-[0.22em] transition-colors duration-300 ${
              m.isCrashed
                ? "text-red-300"
                : m.isResumed
                  ? "text-emerald-300"
                  : m.isArmed
                    ? "text-amber-300"
                    : "text-zinc-500"
            }`}
          >
            {m.isCrashed
              ? "POWER LOST · 94d UPTIME"
              : m.isResumed
                ? "resumed · cached stamp"
                : m.isArmed
                  ? "hold · reasoning"
                  : `${Math.round(BELT_SPEED)} px/s · nominal`}
          </span>
        </div>

        {/* overhead gantry */}
        <div className="pointer-events-none absolute top-16 left-8 right-8 h-3 rounded-sm bg-zinc-800" />

        {/* robot arm, positioned at the stamp x-center (fixed) and descending into belt */}
        <div
          className="pointer-events-none absolute top-16"
          style={{ left: "50%", transform: "translateX(-50%)" }}
        >
          {/* shoulder joint */}
          <div className="h-4 w-4 rounded-full bg-zinc-600" />
          {/* upper arm */}
          <div
            className="relative w-3 bg-zinc-600"
            style={{
              height: `${40 + armY}px`,
              transition: "height 280ms ease-out",
            }}
          />
          {/* elbow */}
          <div className="-ml-1 h-5 w-5 rounded-full bg-zinc-500" />
          {/* stamp head housing */}
          <div
            className="relative -ml-6 flex h-20 w-20 items-center justify-center rounded-md border-4 border-zinc-700 bg-zinc-900"
            style={{
              transform: `rotate(${stampRot}deg)`,
              transition:
                armStage === "frozen-mid"
                  ? "transform 150ms ease-out"
                  : "transform 420ms cubic-bezier(0.4, 1.2, 0.6, 1)",
              boxShadow:
                armStage === "slamming" ||
                armStage === "cached-slam" ||
                armStage === "frozen-mid"
                  ? "0 0 24px rgba(248,113,113,0.6)"
                  : "0 0 16px rgba(52,211,153,0.45)",
            }}
          >
            {/* green face */}
            <div className="absolute inset-2 rounded bg-emerald-500 flex items-center justify-center font-mono text-2xl text-white">
              ✓
            </div>
            {/* red face (opposite side, rotated 180) */}
            <div
              className="absolute inset-2 rounded bg-red-500 flex items-center justify-center font-mono text-xl font-bold text-white"
              style={{ transform: "rotate(180deg)" }}
            >
              FREEZE
            </div>
          </div>
        </div>

        {/* reasoning bubble to the right of joint */}
        <div
          className={`pointer-events-none absolute top-24 transition-opacity duration-300 ${
            reasoningLen > 0 ? "opacity-100" : "opacity-0"
          }`}
          style={{ left: "calc(50% + 80px)" }}
        >
          <div className="rounded-lg border border-amber-400/40 bg-black/80 px-4 py-3 shadow-[0_0_24px_rgba(251,191,36,0.25)]">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300">
              reasoning
            </div>
            <div className="mt-1 min-h-[24px] w-[360px] font-mono text-base tabular-nums text-amber-100">
              {reasoningText.slice(0, reasoningLen)}
              {reasoningLen > 0 && reasoningLen < reasoningText.length && (
                <span className="animate-pulse">▋</span>
              )}
            </div>
          </div>
        </div>

        {/* "cached: already frozen" chip on resume */}
        <div
          className={`pointer-events-none absolute top-8 left-1/2 -translate-x-1/2 transition-opacity duration-500 ${
            m.isResumed ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            cached · already frozen
          </span>
        </div>

        {/* BELT: horizontal across mid-screen */}
        <div className="absolute top-1/2 left-0 h-[140px] w-full -translate-y-1/2 overflow-hidden border-y-2 border-zinc-800 bg-zinc-900">
          {/* belt stripes */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 14px, transparent 14px, transparent 28px)",
              backgroundPosition: `${stripeOffset}px 0`,
              transition: pauseAtFraud
                ? "background-position 500ms ease-out"
                : "none",
            }}
          />
          {/* rollers at ends */}
          <div className="absolute top-1/2 left-2 h-20 w-8 -translate-y-1/2 rounded-full bg-zinc-700 shadow-[inset_0_0_10px_rgba(0,0,0,0.6)]" />
          <div className="absolute top-1/2 right-2 h-20 w-8 -translate-y-1/2 rounded-full bg-zinc-700 shadow-[inset_0_0_10px_rgba(0,0,0,0.6)]" />

          {/* cards */}
          {CHARGES.map((c, i) => {
            // Card x-center relative to belt left. Stamp is at 50%.
            // card i starts far-right and moves toward stampCenter as travel increases.
            const cardCenterFromStamp = (i * SLOT) - travel;
            const leftPct = 50; // stamp is at 50%
            const left = `calc(${leftPct}% + ${cardCenterFromStamp}px - ${CARD_W / 2}px)`;
            const visible = Math.abs(cardCenterFromStamp) < 900;
            if (!visible) return null;

            const passed = i < currentIdx;
            const isFraud = i === FRAUD_IDX;
            const stampedGreen = passed && !isFraud;
            const stampedRed = isFraud && m.isResumed;
            const frozenMid = isFraud && m.isCrashed;
            return (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2"
                style={{
                  left,
                  width: `${CARD_W}px`,
                  transition: pauseAtFraud
                    ? "left 500ms ease-out"
                    : "none",
                }}
              >
                <div
                  className={`relative h-[100px] rounded-md border-2 px-2 py-2 font-mono ${
                    stampedRed
                      ? "border-red-500/70 bg-red-500/15"
                      : frozenMid
                        ? "border-amber-500/60 bg-amber-500/10"
                        : isFraud && m.isArmed
                          ? "border-amber-400/60 bg-amber-400/10"
                          : "border-zinc-700 bg-zinc-800"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    {c.time}
                  </div>
                  <div
                    className={`text-lg tabular-nums ${
                      stampedRed ? "text-red-200" : "text-zinc-100"
                    }`}
                  >
                    {c.card}
                  </div>
                  <div className="truncate text-[11px] text-zinc-400">
                    {c.merchant}
                  </div>
                  <div
                    className={`text-right text-sm tabular-nums ${
                      c.country === "US" ? "text-zinc-300" : "text-red-300"
                    }`}
                  >
                    {c.amount}
                  </div>

                  {/* green stamp decal */}
                  <span
                    className={`pointer-events-none absolute top-1 right-1 text-lg font-bold text-emerald-400 transition-opacity duration-200 ${
                      stampedGreen ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    ✓
                  </span>

                  {/* red FREEZE decal */}
                  <span
                    className={`pointer-events-none absolute top-1 right-1 -rotate-6 font-mono text-[11px] font-bold tracking-[0.2em] text-red-400 transition-opacity duration-300 ${
                      stampedRed ? "opacity-100" : "opacity-0"
                    }`}
                    style={{
                      textShadow: "0 0 6px rgba(248,113,113,0.9)",
                    }}
                  >
                    FREEZE
                  </span>

                  {/* unsealed indicator on frozenMid (crashed) */}
                  <span
                    className={`pointer-events-none absolute bottom-1 right-1 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-300 transition-opacity duration-300 ${
                      frozenMid ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    unsealed
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* crashed "pallet" slides in from bottom */}
        <div
          className={`pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center transition-transform duration-500 ${
            m.isCrashed ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mb-4 rounded-t-xl border-2 border-red-500/60 border-b-0 bg-red-950/70 px-10 py-3 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-red-300">
              power lost · 94d uptime
            </p>
            <p className="mt-1 font-mono text-xl tabular-nums text-red-200">
              arm stuck at {Math.round(stampRot)}°
            </p>
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Arm frozen mid-rotation."
          footer="Card unsealed · event log intact"
        />
        <ReplayingChip active={m.isReplaying} />
        <IdleHint
          eyebrow="fraud sentinel · always on"
          purpose="Stamp · thud · repeat. One pauses."
          active={!m.active}
        />
      </div>

      <ResumedBanner
        active={m.isResumed}
        headline="Red stamp delivered."
        stat={`${FRAUD_CARD} frozen · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
