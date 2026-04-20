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
// Variant 21 · Card duel
// Poker-table green felt. Dealer flips cards face-up left-to-right across an
// arc. Each card = a charge; neutral rank/suit values. The fraud charge flips
// to reveal the JOKER — red, ornate. When the joker lands all other cards
// flip face-down and the joker pulses with a red glow. Kill: joker stays
// frozen face-up, the dealer's silhouette retracts into the shadow. Replay:
// dealer returns, joker still face-up (cached reveal). Resume: emerald banner.
// ---------------------------------------------------------------------------

const FRAUD_IDX = CHARGES.length - 1;
const FLIP_CADENCE_MS = 650;

// Neutral ranks/suits per charge index (non-fraud).
const RANKS = ["7", "4", "10", "K", "3", "9", "J", "6", "5", "2"];
const SUITS = ["spades", "clubs", "spades", "hearts", "clubs", "diamonds", "spades", "clubs", "hearts", "spades"];

type CardSlot = {
  idx: number;
  angleDeg: number; // arc angle from center-bottom pivot
  isFraud: boolean;
  rank: string;
  suit: string;
};

// Precompute arc — cards arranged symmetrically along a gentle downward arc.
function buildSlots(): CardSlot[] {
  const n = CHARGES.length;
  const spread = 64; // degrees across the arc
  const start = -spread / 2;
  const step = spread / (n - 1);
  const out: CardSlot[] = [];
  for (let i = 0; i < n; i++) {
    const isFraud = i === FRAUD_IDX;
    out.push({
      idx: i,
      angleDeg: start + step * i,
      isFraud,
      rank: isFraud ? "JOKER" : RANKS[i % RANKS.length],
      suit: isFraud ? "joker" : SUITS[i % SUITS.length],
    });
  }
  return out;
}

function suitGlyph(suit: string): { glyph: string; red: boolean } {
  switch (suit) {
    case "hearts":   return { glyph: "\u2665", red: true };
    case "diamonds": return { glyph: "\u2666", red: true };
    case "spades":   return { glyph: "\u2660", red: false };
    case "clubs":    return { glyph: "\u2663", red: false };
    default:         return { glyph: "\u2605", red: true };
  }
}

export function CardDuelDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 7_500,
    crashHoldMs: 2_400,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const slots = useMemo(() => buildSlots(), []);

  // ticks count flipped cards; once joker lands (ticks > FRAUD_IDX) we lock.
  const rawTicks = Math.floor(elapsed / FLIP_CADENCE_MS);
  const locked = m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;
  const ticks = locked ? FRAUD_IDX + 1 : Math.min(rawTicks, FRAUD_IDX + 1);
  const jokerLanded = ticks > FRAUD_IDX;

  const scanned = 42_804_192 + Math.min(ticks, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "deal(hand: 11 charges)" });
    out.push({ kind: "RUN", msg: `flipCard(idx: ${Math.min(ticks, FRAUD_IDX)})` });
    if (jokerLanded) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: joker)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed) out.push({ kind: "ERR", msg: "dealer down · table frozen" });
    if (m.isReplaying) out.push({ kind: "RPL", msg: "re-dealing from event log" });
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, ticks, jokerLanded, m.isCrashed, m.isReplaying, m.isResumed]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Card duel · table 7"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(16,66,40,1) 0%, rgba(7,38,22,1) 55%, rgba(2,14,8,1) 100%)",
        }}
      >
        {/* felt stitch ring */}
        <div
          className="pointer-events-none absolute inset-8 rounded-[48%] border border-emerald-900/80"
          style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,0.55)" }}
        />

        {/* scope labels */}
        <div className="pointer-events-none absolute top-6 left-8 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-500/70">
            dealer · hand in play
          </span>
          <span
            className={`font-mono text-3xl tabular-nums transition-colors duration-300 ${
              jokerLanded ? "text-red-300" : "text-emerald-200"
            }`}
          >
            {jokerLanded ? "JOKER · 0.93" : `${Math.min(ticks, FRAUD_IDX)} / ${FRAUD_IDX} dealt`}
          </span>
        </div>
        <div className="pointer-events-none absolute top-6 right-8 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-500/70">
            elapsed
          </span>
          <span className="font-mono text-3xl tabular-nums text-zinc-200">
            {Math.floor(elapsed / 1000).toString().padStart(2, "0")}
            :
            {Math.floor((elapsed / 10) % 100).toString().padStart(2, "0")}
          </span>
        </div>

        {/* cards arc */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="relative"
            style={{ width: "1px", height: "1px" }}
          >
            {slots.map((slot) => {
              const flipped = ticks > slot.idx;
              // After joker lands, non-joker cards flip BACK face-down.
              const forceFaceDown = jokerLanded && !slot.isFraud;
              const showFace = flipped && !forceFaceDown;
              const dimmed = jokerLanded && !slot.isFraud;
              return (
                <CardOnArc
                  key={slot.idx}
                  slot={slot}
                  showFace={showFace}
                  dimmed={dimmed}
                  pulseRed={slot.isFraud && jokerLanded}
                />
              );
            })}
          </div>
        </div>

        {/* Dealer silhouette — bottom left. Retracts on crash. */}
        <div
          className={`pointer-events-none absolute bottom-4 left-8 transition-all duration-500 ${
            m.isCrashed ? "translate-x-[-120px] opacity-0" : "translate-x-0 opacity-100"
          }`}
        >
          <svg viewBox="0 0 120 120" className="h-28 w-28">
            <defs>
              <radialGradient id="dealer-grad" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="rgb(30,30,35)" />
                <stop offset="100%" stopColor="rgb(0,0,0)" />
              </radialGradient>
            </defs>
            {/* shoulders */}
            <path
              d="M 10 110 Q 30 70 60 70 Q 90 70 110 110 Z"
              fill="url(#dealer-grad)"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
            {/* head */}
            <circle cx="60" cy="44" r="20" fill="url(#dealer-grad)" stroke="rgba(255,255,255,0.08)" />
            {/* hand reaching out */}
            <path
              d="M 95 100 Q 120 90 135 80"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Dealer down · hand frozen"
          footer="Event log intact · joker cached"
        />
        <ReplayingChip active={m.isReplaying} />
        <IdleHint
          eyebrow="fraud sentinel · always on"
          purpose="94 days dealing the same hand."
          active={!m.active}
        />
      </div>

      <ResumedBanner
        active={m.isResumed}
        headline="94 hands dealt · 1 kill survived."
        stat={`${FRAUD_CARD} · ${FRAUD_MERCHANT} · 1,248 jokers caught`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardOnArc — one card pre-positioned at its arc angle. Flip driven by CSS
// rotateY. No conditional mount; layout is stable.
// ---------------------------------------------------------------------------

function CardOnArc({
  slot,
  showFace,
  dimmed,
  pulseRed,
}: {
  slot: CardSlot;
  showFace: boolean;
  dimmed: boolean;
  pulseRed: boolean;
}) {
  // Pivot-based arc: translate out from center along a radius at slot angle.
  // Cards sit on the arc with a subtle rotation matching tangent.
  const radius = 320;
  const tiltDeg = slot.angleDeg * 0.6;
  return (
    <div
      className="absolute"
      style={{
        transform: `rotate(${slot.angleDeg}deg) translate(0, -${radius}px) rotate(${-slot.angleDeg + tiltDeg}deg)`,
        transformOrigin: "center center",
        left: "-56px",
        top: "-80px",
        width: "112px",
        height: "160px",
        transition: "opacity 400ms ease",
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      {/* flip container */}
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          transform: showFace ? "rotateY(0deg)" : "rotateY(180deg)",
          transition: "transform 500ms cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {/* FACE */}
        <div
          className="absolute inset-0 rounded-xl border bg-white text-black shadow-[0_6px_20px_rgba(0,0,0,0.55)]"
          style={{
            backfaceVisibility: "hidden",
            borderColor: slot.isFraud ? "rgb(220,38,38)" : "rgba(0,0,0,0.15)",
            boxShadow: pulseRed
              ? "0 0 32px rgba(248,113,113,0.85), 0 0 64px rgba(248,113,113,0.35)"
              : "0 6px 20px rgba(0,0,0,0.55)",
            animation: pulseRed ? "cardDuelPulse 1.4s ease-in-out infinite" : undefined,
          }}
        >
          {slot.isFraud ? <JokerFace /> : <PipFace rank={slot.rank} suit={slot.suit} />}
        </div>
        {/* BACK */}
        <div
          className="absolute inset-0 rounded-xl border border-red-900/60"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background:
              "repeating-linear-gradient(45deg, rgb(127,29,29) 0 6px, rgb(69,10,10) 6px 12px)",
            boxShadow: "inset 0 0 14px rgba(0,0,0,0.6)",
          }}
        >
          <div className="m-2 h-[calc(100%-16px)] w-[calc(100%-16px)] rounded-md border border-red-300/20" />
        </div>
      </div>

      <style>{`
        @keyframes cardDuelPulse {
          0%, 100% { box-shadow: 0 0 24px rgba(248,113,113,0.55), 0 0 56px rgba(248,113,113,0.25); }
          50%      { box-shadow: 0 0 44px rgba(248,113,113,0.95), 0 0 96px rgba(248,113,113,0.55); }
        }
      `}</style>
    </div>
  );
}

function PipFace({ rank, suit }: { rank: string; suit: string }) {
  const g = suitGlyph(suit);
  const color = g.red ? "text-red-600" : "text-zinc-900";
  return (
    <div className={`relative flex h-full w-full flex-col justify-between p-2 font-mono ${color}`}>
      <div className="flex flex-col items-center leading-none">
        <span className="text-xl font-bold">{rank}</span>
        <span className="text-lg">{g.glyph}</span>
      </div>
      <div className="flex items-center justify-center text-5xl">{g.glyph}</div>
      <div className="flex rotate-180 flex-col items-center leading-none">
        <span className="text-xl font-bold">{rank}</span>
        <span className="text-lg">{g.glyph}</span>
      </div>
    </div>
  );
}

function JokerFace() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between p-2">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">
        JOKER
      </span>
      <svg viewBox="0 0 80 80" className="h-16 w-16">
        <defs>
          <radialGradient id="joker-hat" cx="50%" cy="40%">
            <stop offset="0%" stopColor="rgb(220,38,38)" />
            <stop offset="100%" stopColor="rgb(127,29,29)" />
          </radialGradient>
        </defs>
        {/* jester face */}
        <circle cx="40" cy="48" r="16" fill="rgb(250,220,180)" stroke="rgb(127,29,29)" strokeWidth="1" />
        {/* hat 3 points w/ bells */}
        <path
          d="M 20 42 L 10 18 L 22 30 L 40 10 L 58 30 L 70 18 L 60 42 Z"
          fill="url(#joker-hat)"
          stroke="rgb(127,29,29)"
          strokeWidth="1"
        />
        <circle cx="10" cy="18" r="3" fill="rgb(253,224,71)" />
        <circle cx="40" cy="10" r="3" fill="rgb(253,224,71)" />
        <circle cx="70" cy="18" r="3" fill="rgb(253,224,71)" />
        {/* eyes */}
        <circle cx="34" cy="48" r="1.5" fill="rgb(20,20,20)" />
        <circle cx="46" cy="48" r="1.5" fill="rgb(20,20,20)" />
        {/* mouth */}
        <path d="M 32 55 Q 40 60 48 55" stroke="rgb(127,29,29)" strokeWidth="1.5" fill="none" />
      </svg>
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-red-700">
        risk 0.93
      </span>
    </div>
  );
}
