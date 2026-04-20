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
// Variant 02 · Choir
// 40 worker avatars humming in unison. One notices the fraud, then all 40
// snap to watch it. Crash → half the grid goes dark. Replay → dark half
// re-illuminates. Resume → all 40 briefly flash FROZEN.
// ---------------------------------------------------------------------------

const ROWS = 5;
const COLS = 8;
const COUNT = ROWS * COLS; // 40
// The avatar that "notices" — centered so the radial snap reads cleanly.
const NOTICER = 3 * COLS + 4;

type AvatarKind = "humming" | "notice" | "fraud" | "dark" | "frozen";

function workerId(i: number): string {
  return `W-${(4820 + i).toString(36).toUpperCase()}`;
}

export function ChoirDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 7_500,
    crashHoldMs: 2_200,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const ticks = Math.floor(elapsed / 700);
  const scanned = 42_804_192 + Math.min(ticks, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  // During armed+ the choir snaps to watch the noticer. Before that, ambient.
  const watching = m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;

  const avatarState = (i: number): AvatarKind => {
    if (m.isCrashed) {
      // Half dark — checkerboard pattern so it reads as "half the grid"
      return (Math.floor(i / COLS) + i) % 2 === 0 ? "dark" : "humming";
    }
    if (m.isReplaying) {
      return "humming";
    }
    if (m.isResumed) {
      if (i === NOTICER) return "fraud";
      return "frozen";
    }
    if (m.isArmed) {
      if (i === NOTICER) return "fraud";
      return "notice";
    }
    return "humming";
  };

  // Compute a rotation angle for each avatar so they turn toward the noticer.
  // Only applied when `watching` becomes true.
  const angleTo = useMemo(() => {
    const res: number[] = [];
    const nrow = Math.floor(NOTICER / COLS);
    const ncol = NOTICER % COLS;
    for (let i = 0; i < COUNT; i++) {
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      const dy = nrow - r;
      const dx = ncol - c;
      res.push((Math.atan2(dy, dx) * 180) / Math.PI + 90);
    }
    return res;
  }, []);

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: `scanCharges · 40 workers humming` });
    if (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `choir holds · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "server down · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying event log" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, m.isArmed, m.isCrashed, m.isReplaying, m.isResumed]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Choir · 40 workers"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        {/* header label */}
        <div className="pointer-events-none absolute top-6 left-8">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            scoring pool · 40 workers
          </span>
        </div>
        <div className="pointer-events-none absolute top-6 right-8">
          <span
            className={`font-mono text-[11px] uppercase tracking-[0.22em] transition-colors duration-300 ${
              m.isResumed
                ? "text-emerald-300"
                : m.isArmed
                  ? "text-red-300"
                  : "text-zinc-500"
            }`}
          >
            {m.isResumed
              ? "frozen · in unison"
              : m.isArmed
                ? "one · noticed"
                : "humming · sky-C"}
          </span>
        </div>

        {/* Flash banner FROZEN on resume */}
        <div
          className={`pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-[200px] transition-opacity duration-500 ${
            m.isResumed ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="font-mono text-6xl font-bold tracking-[0.3em] text-emerald-300 drop-shadow-[0_0_24px_rgba(52,211,153,0.8)]">
            FROZEN
          </span>
        </div>

        {/* grid */}
        <div className="absolute inset-0 flex items-center justify-center p-16">
          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: COUNT }).map((_, i) => {
              const kind = avatarState(i);
              const row = Math.floor(i / COLS);
              const col = i % COLS;
              // Humming wave — phase based on grid diagonal
              const phase = (row + col) * 0.18;
              const amp =
                0.6 + 0.4 * Math.sin((elapsed / 500) + phase);
              const rot = watching ? angleTo[i] : 0;

              const ring =
                kind === "fraud"
                  ? "border-red-400 shadow-[0_0_24px_rgba(248,113,113,0.8)] bg-red-500/20"
                  : kind === "notice"
                    ? "border-amber-300/70 bg-amber-400/10"
                    : kind === "frozen"
                      ? "border-emerald-400/70 bg-emerald-500/10 shadow-[0_0_16px_rgba(52,211,153,0.5)]"
                      : kind === "dark"
                        ? "border-zinc-800 bg-zinc-900/50 opacity-30"
                        : "border-sky-400/50 bg-sky-500/10";

              const dot =
                kind === "fraud"
                  ? "bg-red-300"
                  : kind === "notice"
                    ? "bg-amber-300"
                    : kind === "frozen"
                      ? "bg-emerald-300"
                      : kind === "dark"
                        ? "bg-zinc-700"
                        : "bg-sky-300";

              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1"
                  style={{
                    transform: `rotate(${rot}deg)`,
                    transition: "transform 500ms cubic-bezier(0.4, 1.6, 0.6, 1)",
                  }}
                >
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all duration-300 ${ring}`}
                    style={{
                      transform: `scale(${kind === "fraud" ? 1.15 : kind === "dark" ? 0.9 : 0.95 + amp * 0.1})`,
                    }}
                  >
                    <span
                      className={`h-3 w-3 rounded-full ${dot}`}
                      style={{
                        opacity:
                          kind === "humming"
                            ? 0.5 + amp * 0.5
                            : kind === "dark"
                              ? 0.25
                              : 1,
                      }}
                    />
                  </div>
                  {/* amplitude bar under avatar */}
                  <div className="relative h-1 w-10 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full transition-all duration-200 ${
                        kind === "fraud"
                          ? "bg-red-400"
                          : kind === "notice"
                            ? "bg-amber-300"
                            : kind === "frozen"
                              ? "bg-emerald-400"
                              : kind === "dark"
                                ? "bg-zinc-700"
                                : "bg-sky-400"
                      }`}
                      style={{
                        width:
                          kind === "dark"
                            ? "10%"
                            : kind === "fraud"
                              ? "100%"
                              : `${35 + amp * 55}%`,
                      }}
                    />
                  </div>
                  <span
                    className="font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-600"
                    style={{ transform: `rotate(${-rot}deg)` }}
                  >
                    {workerId(i)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Half the choir fell silent"
          footer="20 workers offline · event log intact"
        />
        <ReplayingChip active={m.isReplaying} />
        <IdleHint
          eyebrow="fraud sentinel · always on"
          purpose="40 voices. One fraud."
          active={!m.active}
        />
      </div>

      <ResumedBanner
        active={m.isResumed}
        headline="Choir in unison."
        stat={`${FRAUD_CARD} frozen · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
