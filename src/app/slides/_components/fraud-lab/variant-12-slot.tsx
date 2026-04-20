"use client";

import { useMemo } from "react";
import { AgentDebugDrawer, type DebugEvent } from "../agent-debug-drawer";
import {
  CHARGES,
  FRAUD_CARD,
  FRAUD_MERCHANT,
  FRAUD_COUNTRY,
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
// Variant 12 · Slot machine
// Oversized cabinet with three giant reels (card, merchant, country). Every
// charge pulls the lever automatically — click click click to CLEAR. On fraud
// the three reels land [8891][CRYPTONOME][RU] in red, siren flashes, lever
// LOCKS, and a FROZEN card slides out the front. Crash freezes reels with blur
// and a "OUT OF ORDER" marquee. Replay unblurs; resume keeps the frozen drawer.
// ---------------------------------------------------------------------------

const SPIN_PERIOD_MS = 2_000;

type Reel = { label: string; items: string[] };

const REELS: Reel[] = [
  {
    label: "card",
    items: [
      "4242",
      "1117",
      "9003",
      "5541",
      "2200",
      "3384",
      "7719",
      "6106",
      "0458",
      "4242",
    ],
  },
  {
    label: "merchant",
    items: [
      "APPLE",
      "UBER",
      "TARGET",
      "STARBUX",
      "SHELL",
      "DOORDASH",
      "NETFLIX",
      "AMAZON",
      "HOME DEPOT",
      "APPLE",
    ],
  },
  {
    label: "country",
    items: ["US", "US", "US", "US", "US", "US", "US", "US", "US", "US"],
  },
];

const FRAUD_FACES = ["8891", "CRYPTONOME", FRAUD_COUNTRY];

export function SlotDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_000,
    crashHoldMs: 2_200,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const ticks = Math.floor(elapsed / 700);
  const scanned = 42_804_192 + Math.min(ticks, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  // Which reel face is currently showing per reel (cycled during live)
  const liveIdx = Math.floor(elapsed / SPIN_PERIOD_MS) % REELS[0].items.length;
  const lockedOnFraud =
    m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;

  // spinning state — brief spin between stops
  const spinT = (elapsed % SPIN_PERIOD_MS) / SPIN_PERIOD_MS;
  const isSpinning = !lockedOnFraud && spinT < 0.45 && m.active;

  // Lever pull phase drives the cabinet vibration feel
  const blur = m.isCrashed;

  const pullsShown = 13_249 + Math.min(ticks, CHARGES.length);

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    out.push({ kind: "RUN", msg: `pullLever(rows: 3)` });
    if (lockedOnFraud) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "out of order · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying reels" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, lockedOnFraud, m.isCrashed, m.isReplaying, m.isResumed]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Slot · cabinet"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        {/* Cabinet */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-10 py-8">
          {/* Siren lights on top */}
          <div className="flex items-center gap-6">
            <SirenLight active={lockedOnFraud} delay={0} />
            <div
              className={`font-mono text-xl uppercase tracking-[0.3em] transition-colors duration-500 ${
                lockedOnFraud
                  ? "text-red-300"
                  : m.isCrashed
                    ? "text-zinc-500"
                    : "text-amber-300"
              }`}
            >
              {blur ? "OUT OF ORDER · LEDGER SEALED" : lockedOnFraud ? "JACKPOT · FROZEN" : "SENTINEL · FAIR PLAY"}
            </div>
            <SirenLight active={lockedOnFraud} delay={120} />
          </div>

          {/* Reels */}
          <div
            className={`relative flex items-center justify-center gap-5 rounded-2xl border-[6px] bg-gradient-to-b from-zinc-900 to-black px-8 py-6 transition-all duration-500 ${
              lockedOnFraud
                ? "border-red-500/60 shadow-[0_0_50px_rgba(248,113,113,0.35)]"
                : "border-amber-500/30"
            } ${blur ? "blur-[2px]" : ""}`}
          >
            {REELS.map((reel, reelIdx) => (
              <Reel
                key={reel.label}
                label={reel.label}
                items={reel.items}
                currentIdx={liveIdx}
                fraudFace={FRAUD_FACES[reelIdx]}
                isFraud={lockedOnFraud}
                spinning={isSpinning}
                spinSeed={reelIdx}
                revealDelay={reelIdx * 140}
              />
            ))}
          </div>

          {/* Counter */}
          <div className="flex items-center gap-8 font-mono text-sm uppercase tracking-[0.22em]">
            <span className="text-zinc-500">
              LOOPS: <span className="text-zinc-200 tabular-nums">{pullsShown.toLocaleString()}</span>
            </span>
            <span className="text-zinc-500">
              PAYOUT: <span className="text-zinc-200">NEVER</span>
            </span>
            <span className="text-zinc-500">
              UPTIME: <span className="text-zinc-200">94d</span>
            </span>
          </div>

          {/* Lever + drawer row */}
          <div className="flex w-full max-w-[780px] items-end justify-between">
            {/* Drawer */}
            <div
              className={`rounded-xl border bg-zinc-950 px-5 py-3 text-center transition-all duration-700 ${
                lockedOnFraud
                  ? "translate-y-0 border-red-500/60 opacity-100 shadow-[0_0_24px_rgba(248,113,113,0.4)]"
                  : "translate-y-4 border-white/10 opacity-0"
              }`}
            >
              <span className="block font-mono text-[10px] uppercase tracking-[0.3em] text-red-400">
                under glass
              </span>
              <span className="mt-1 block font-mono text-xl text-red-200">
                FROZEN · {FRAUD_CARD}
              </span>
            </div>

            {/* Lever */}
            <div className="flex flex-col items-end gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                lever
              </span>
              <div
                className={`relative h-24 w-4 rounded-full transition-all duration-500 ${
                  lockedOnFraud
                    ? "bg-gradient-to-b from-red-500 to-red-900"
                    : "bg-gradient-to-b from-amber-400 to-amber-700"
                }`}
              >
                <div
                  className={`absolute top-0 left-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 transition-all duration-500 ${
                    lockedOnFraud
                      ? "border-red-700 bg-red-400"
                      : "border-amber-700 bg-amber-300"
                  }`}
                />
              </div>
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.3em] transition-colors duration-500 ${
                  lockedOnFraud ? "text-red-300" : "text-zinc-500"
                }`}
              >
                {lockedOnFraud ? "LOCKED" : "AUTO"}
              </span>
            </div>
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Cabinet offline · process killed"
          footer="Event log intact · reels cached"
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

// --- reel ---------------------------------------------------------------

function Reel({
  label,
  items,
  currentIdx,
  fraudFace,
  isFraud,
  spinning,
  spinSeed,
  revealDelay,
}: {
  label: string;
  items: string[];
  currentIdx: number;
  fraudFace: string;
  isFraud: boolean;
  spinning: boolean;
  spinSeed: number;
  revealDelay: number;
}) {
  // Compute a "spin" offset — items whirl when spinning, otherwise stop on currentIdx.
  const visibleIdx = spinning
    ? (currentIdx + spinSeed * 3) % items.length
    : currentIdx % items.length;
  const face = isFraud ? fraudFace : items[visibleIdx];

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        {label}
      </span>
      <div
        className={`relative flex h-[260px] w-[200px] items-center justify-center overflow-hidden rounded-xl border-4 bg-black transition-all duration-500 ${
          isFraud
            ? "border-red-500 bg-red-500/10 shadow-[inset_0_0_30px_rgba(248,113,113,0.45)]"
            : "border-amber-400/30"
        }`}
        style={{ transitionDelay: `${revealDelay}ms` }}
      >
        {/* Top + bottom ghost rows */}
        <div className="absolute inset-x-0 top-3 text-center font-mono text-2xl opacity-25 tabular-nums text-zinc-400">
          {items[(visibleIdx + items.length - 1) % items.length]}
        </div>
        <div className="absolute inset-x-0 bottom-3 text-center font-mono text-2xl opacity-25 tabular-nums text-zinc-400">
          {items[(visibleIdx + 1) % items.length]}
        </div>

        {/* Spin blur overlay */}
        <div
          className={`absolute inset-0 transition-opacity duration-200 ${
            spinning ? "opacity-70" : "opacity-0"
          }`}
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 2px, transparent 2px 6px)",
          }}
        />

        {/* Current face */}
        <div
          className={`relative z-10 font-mono text-5xl font-black tracking-tight tabular-nums transition-colors duration-500 ${
            isFraud
              ? "text-red-300"
              : spinning
                ? "text-zinc-400"
                : "text-amber-200"
          }`}
          style={{
            filter: isFraud
              ? "drop-shadow(0 0 10px rgba(248,113,113,0.6))"
              : "none",
          }}
        >
          {face}
        </div>
      </div>
      <span
        className={`font-mono text-xs uppercase tracking-[0.2em] transition-colors duration-500 ${
          isFraud ? "text-red-300" : "text-emerald-300/70"
        }`}
      >
        {isFraud ? "HIGH RISK" : "LOW RISK"}
      </span>
    </div>
  );
}

function SirenLight({ active, delay }: { active: boolean; delay: number }) {
  return (
    <div
      className={`h-5 w-5 rounded-full transition-all duration-300 ${
        active
          ? "bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.9)] animate-pulse"
          : "bg-zinc-800"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
