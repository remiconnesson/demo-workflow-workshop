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
// Variant 03 · Ticker tape
// Warm brass/parchment ticker tape scrolls right-to-left. A stamp head
// hovers above and thuds a green check onto each block. On the fraud
// block, the stamp hesitates, rotates, slams red "FROZEN" that bleeds.
// Crash → tape jams and a red wax seal appears. Replay → tape spools back
// and re-reads. Resume → finishes.
// ---------------------------------------------------------------------------

// Pixels per charge block. Wide enough to show [time · card · merchant · amt].
const BLOCK_W = 560;
const FRAUD_IDX = CHARGES.length - 1;
// Speed: take ~1s to traverse one block
const MS_PER_BLOCK = 1100;

type StampKind = "green" | "red" | "hover" | "slam" | "jammed";

export function TapeDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_000,
    crashHoldMs: 2_200,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  // Which block index is currently "under" the stamp?
  // Progress from 0 -> CHARGES.length-1 as elapsed grows.
  const progress = m.active ? elapsed / MS_PER_BLOCK : 0;
  const currentIdx = Math.min(Math.floor(progress), CHARGES.length - 1);

  // Pause the tape under the stamp when we reach the fraud block.
  const pauseAtFraud = m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;

  // Tape translation: move left by (progress * BLOCK_W). Freeze at fraud.
  const tapeShift = pauseAtFraud
    ? -(FRAUD_IDX - 0.5) * BLOCK_W
    : -(progress - 0.5) * BLOCK_W;

  // Replay re-read: small scrub animation
  const replayScrub = m.isReplaying
    ? Math.sin((elapsed % 1800) / 1800 * Math.PI) * 40
    : 0;

  const stampKind: StampKind = m.isCrashed
    ? "jammed"
    : m.isReplaying
      ? "hover"
      : m.isResumed
        ? "red"
        : m.isArmed
          ? "slam"
          : "green";

  const scanned = 42_804_192 + Math.min(currentIdx, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(tape reel)" });
    if (currentIdx > 0) {
      out.push({ kind: "RUN", msg: `stamp(batch: ${Math.min(currentIdx, FRAUD_IDX)} cleared)` });
    }
    if (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `stamp hesitates · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "tape jammed · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "re-spooling event log" });
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
        title="Ticker tape"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        {/* tape rails — brass parchment */}
        <div className="pointer-events-none absolute top-1/2 left-0 h-[220px] w-full -translate-y-1/2 overflow-hidden border-y-2 border-amber-300/20 bg-amber-100/5">
          {/* sprocket holes along top */}
          <div className="absolute top-2 left-0 flex h-3 w-full gap-8 px-4">
            {Array.from({ length: 40 }).map((_, i) => (
              <span
                key={i}
                className="h-3 w-3 shrink-0 rounded-full bg-black/60 border border-amber-300/20"
              />
            ))}
          </div>
          <div className="absolute bottom-2 left-0 flex h-3 w-full gap-8 px-4">
            {Array.from({ length: 40 }).map((_, i) => (
              <span
                key={i}
                className="h-3 w-3 shrink-0 rounded-full bg-black/60 border border-amber-300/20"
              />
            ))}
          </div>

          {/* Tape itself — absolutely positioned blocks */}
          <div
            className="absolute top-1/2 left-1/2 flex h-[140px] -translate-y-1/2 items-center"
            style={{
              transform: `translate(calc(-50% + ${tapeShift + replayScrub}px), -50%)`,
              transition: pauseAtFraud
                ? "transform 600ms cubic-bezier(0.4, 0, 0.2, 1)"
                : "none",
            }}
          >
            {CHARGES.map((c, i) => {
              const passed = i < currentIdx;
              const isFraud = i === FRAUD_IDX;
              const stamped = passed && !isFraud;
              const frozenStamped = isFraud && m.isResumed;
              return (
                <div
                  key={i}
                  className="relative flex h-full items-center justify-between border-r-2 border-amber-300/30 px-8"
                  style={{ width: `${BLOCK_W}px` }}
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs uppercase tracking-[0.22em] text-amber-200/60">
                      {c.time} · loop {loop}
                    </span>
                    <span className="font-mono text-3xl tabular-nums text-amber-100">
                      {c.card}
                    </span>
                    <span className="font-mono text-lg text-amber-200/80">
                      {c.merchant}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`font-mono text-4xl tabular-nums ${
                        isFraud ? "text-red-300" : "text-amber-50"
                      }`}
                    >
                      {c.amount}
                    </span>
                    <span
                      className={`font-mono text-sm ${
                        c.country === "US"
                          ? "text-amber-200/70"
                          : "text-red-300"
                      }`}
                    >
                      {c.country}
                    </span>
                  </div>

                  {/* stamp mark — green check for cleared, red FROZEN for fraud */}
                  <div
                    className={`pointer-events-none absolute top-2 right-8 font-mono text-2xl font-bold tracking-[0.2em] transition-opacity duration-300 ${
                      stamped ? "opacity-100" : "opacity-0"
                    }`}
                    style={{ color: "rgba(74,222,128,0.85)" }}
                  >
                    ✓
                  </div>

                  {/* fraud red FROZEN mark with "bleeding" */}
                  <div
                    className={`pointer-events-none absolute top-1 right-4 rotate-[-8deg] font-mono text-3xl font-bold tracking-[0.25em] text-red-400 transition-opacity duration-500 ${
                      frozenStamped ? "opacity-100" : "opacity-0"
                    }`}
                    style={{
                      textShadow:
                        "0 0 6px rgba(248,113,113,0.9), 0 6px 0 rgba(127,29,29,0.6)",
                    }}
                  >
                    FROZEN
                  </div>

                  {/* bleed drip under FROZEN */}
                  <div
                    className={`pointer-events-none absolute top-10 right-10 h-14 w-1 rounded-b-full bg-red-500/80 transition-all duration-700 ${
                      frozenStamped ? "opacity-80 h-14" : "opacity-0 h-0"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* stamp head — sits above center, descends when engaging */}
        <div className="pointer-events-none absolute left-1/2 top-[calc(50%-200px)] -translate-x-1/2">
          <StampHead kind={stampKind} elapsed={elapsed} />
        </div>

        {/* wax seal on crash */}
        <div
          className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 ${
            m.isCrashed ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-red-700/80 bg-red-600/90 font-mono text-xs font-bold uppercase tracking-[0.3em] text-red-100 shadow-[0_0_40px_rgba(248,113,113,0.6)]"
            style={{
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              background:
                "radial-gradient(circle at 30% 30%, rgba(220,38,38,0.95), rgba(127,29,29,0.95))",
            }}
          >
            JAM · SEAL
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Tape jammed mid-stamp."
          footer="Red seal applied · log intact"
        />
        <ReplayingChip active={m.isReplaying} />
        <IdleHint
          eyebrow="fraud sentinel · always on"
          purpose="Stamp every charge. Hesitate on one."
          active={!m.active}
        />
      </div>

      <ResumedBanner
        active={m.isResumed}
        headline="Red stamp settled."
        stat={`${FRAUD_CARD} frozen · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}

// --- stamp head --------------------------------------------------------

function StampHead({
  kind,
  elapsed,
}: {
  kind: StampKind;
  elapsed: number;
}) {
  // Bob up and down when green (slam). Hold higher when hesitating. Jammed = stuck halfway.
  const bob =
    kind === "green"
      ? 18 + 18 * Math.sin((elapsed / 120) % (Math.PI * 2))
      : kind === "slam"
        ? 10
        : kind === "red"
          ? 6
          : kind === "jammed"
            ? 40
            : 60;

  const color =
    kind === "green"
      ? "bg-emerald-500"
      : kind === "red"
        ? "bg-red-500"
        : kind === "slam"
          ? "bg-red-500"
          : kind === "jammed"
            ? "bg-red-600"
            : "bg-amber-400";

  // Stamp head rotation (between green and red heads)
  const rot =
    kind === "slam" || kind === "red"
      ? 180
      : kind === "jammed"
        ? 90
        : 0;

  return (
    <div className="flex flex-col items-center">
      {/* arm */}
      <div className="h-16 w-4 bg-zinc-600" />
      {/* head housing */}
      <div
        className={`relative flex h-20 w-20 items-center justify-center rounded-xl border-4 border-zinc-700 bg-zinc-900 transition-transform duration-300`}
        style={{
          transform: `translateY(${bob}px) rotate(${rot}deg)`,
          transition:
            "transform 350ms cubic-bezier(0.4, 1.6, 0.6, 1)",
        }}
      >
        <div
          className={`h-12 w-12 rounded-md ${color} transition-colors duration-200`}
          style={{
            boxShadow:
              kind === "red" || kind === "slam" || kind === "jammed"
                ? "0 0 24px rgba(248,113,113,0.6)"
                : "0 0 16px rgba(52,211,153,0.5)",
          }}
        />
        {/* glyph on head */}
        <span
          className="absolute font-mono text-xl font-bold text-white"
          style={{ transform: `rotate(${-rot}deg)` }}
        >
          {kind === "green" ? "✓" : "✕"}
        </span>
      </div>
    </div>
  );
}
