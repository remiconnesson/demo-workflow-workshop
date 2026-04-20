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
// Variant 09 · Reading AI (hero)
// One enormous slab of typewriter text fills the canvas. Past sentences
// fade up and out; the present sentence types in. On the fraud charge the
// monologue pauses, hesitates ("Wait."), reasons line by line, then
// announces "I am freezing it." — FREEZING swells briefly, then collapses.
// On crash the cursor freezes mid-word. On replay, cached watermark.
// On resume, continues from exactly the paused word.
// ---------------------------------------------------------------------------

const FRAUD_IDX = CHARGES.length - 1;

type Beat = {
  // text to type
  text: string;
  // ms to spend (post-delivery dwell) before moving on
  hold: number;
  // highlight tone: neutral/amber/red/big
  tone: "neutral" | "amber" | "red" | "big";
};

// Pre-fraud beats — short, repetitive "clearing" narration
const PRE_FRAUD_BEATS: Beat[] = CHARGES.slice(0, FRAUD_IDX).map((c, i) => {
  const cardShort = c.card.replace("•••• ", "");
  const templates = [
    `${cardShort} at ${c.merchant}. Familiar. Skip.`,
    `${cardShort} · ${c.merchant}. Weekday, city center. Skip.`,
    `${cardShort} · ${c.merchant}. Low amount. Skip.`,
    `${cardShort} · ${c.merchant}. Priors match. Skip.`,
  ];
  return {
    text: templates[i % templates.length],
    hold: 700,
    tone: "neutral" as const,
  };
});

// Fraud beats — the monologue that makes the audience lean in
const FRAUD_BEATS: Beat[] = [
  { text: `8891 at Cryptonome-XYZ.`, hold: 900, tone: "neutral" },
  { text: `Wait.`, hold: 1100, tone: "amber" },
  { text: `This card has never charged abroad.`, hold: 900, tone: "amber" },
  { text: `This merchant has no history.`, hold: 900, tone: "amber" },
  { text: `This amount is 3× typical.`, hold: 900, tone: "amber" },
  { text: `I am freezing it.`, hold: 900, tone: "red" },
];

// Ms for typing a full beat's text.
const TYPE_SPEED_MS_PER_CHAR = 30;

function cumulativeBeatEnds(beats: Beat[]): number[] {
  const ends: number[] = [];
  let t = 0;
  for (const b of beats) {
    t += b.text.length * TYPE_SPEED_MS_PER_CHAR + b.hold;
    ends.push(t);
  }
  return ends;
}

const PRE_FRAUD_END_TIMES = cumulativeBeatEnds(PRE_FRAUD_BEATS);
const PRE_FRAUD_TOTAL = PRE_FRAUD_END_TIMES[PRE_FRAUD_END_TIMES.length - 1] ?? 0;
const FRAUD_BEAT_END_TIMES = cumulativeBeatEnds(FRAUD_BEATS);
const FRAUD_TOTAL = FRAUD_BEAT_END_TIMES[FRAUD_BEAT_END_TIMES.length - 1] ?? 0;

// The "freezing it" beat is the last beat of FRAUD_BEATS
const FREEZING_BEAT_INDEX = FRAUD_BEATS.length - 1;

// Precompute: for the "crash mid-word" moment we target beat index 5 ("I am freezing it.")
// stop at the exact character count of "I am freez"
const CRASH_WORD = "I am freez";
const CRASH_CHARS_IN_BEAT = CRASH_WORD.length;

export function ReadingAiDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_000,
    crashHoldMs: 2_200,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active, 50);

  const pauseOnFraud =
    m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;

  // ---- figure out which beats are delivered and which beat is current ----
  // "live" phase time is elapsed directly; pre-fraud beats run until fraud arrives.
  // Once armed, fraud beats play on their own timeline.
  // Pre-fraud time budget = 8s (armedAfterMs) — we pack only a few pre-fraud beats.
  const preFraudClock = Math.min(elapsed, PRE_FRAUD_TOTAL);

  // How many pre-fraud beats are fully delivered
  let preFraudDelivered = 0;
  for (let i = 0; i < PRE_FRAUD_BEATS.length; i++) {
    if (preFraudClock >= PRE_FRAUD_END_TIMES[i]) preFraudDelivered = i + 1;
  }

  // Which pre-fraud beat is "active" (typing) — the one we haven't finished.
  const activePreIdx = Math.min(
    preFraudDelivered,
    PRE_FRAUD_BEATS.length - 1,
  );
  // Characters of the active pre-fraud beat typed so far
  const activePreStart =
    activePreIdx === 0 ? 0 : PRE_FRAUD_END_TIMES[activePreIdx - 1];
  const activePreBeat = PRE_FRAUD_BEATS[activePreIdx];
  const activePreElapsed = Math.max(0, preFraudClock - activePreStart);
  const activePreTypeMs = activePreBeat.text.length * TYPE_SPEED_MS_PER_CHAR;
  const activePreChars = Math.min(
    activePreBeat.text.length,
    Math.floor(activePreElapsed / TYPE_SPEED_MS_PER_CHAR),
  );
  const activePreDelivered = activePreElapsed >= activePreTypeMs;

  // ---- fraud clock ----
  // fraud clock begins when phase becomes armed
  // approximate: elapsed - armedAfterMs (8000)
  const fraudStart = 8_000;
  const fraudClockRaw = Math.max(0, elapsed - fraudStart);

  // During CRASH we want the cursor to freeze inside the final beat at "I am freez"
  // So compute a "max fraud clock" cutoff when crashed.
  let fraudClock: number;
  if (m.isCrashed || m.isReplaying) {
    // Freeze at beat 5 partially typed
    const beatStart = FREEZING_BEAT_INDEX === 0 ? 0 : FRAUD_BEAT_END_TIMES[FREEZING_BEAT_INDEX - 1];
    fraudClock = beatStart + CRASH_CHARS_IN_BEAT * TYPE_SPEED_MS_PER_CHAR;
  } else if (m.isResumed) {
    fraudClock = FRAUD_TOTAL;
  } else if (m.isArmed) {
    fraudClock = Math.min(fraudClockRaw, FRAUD_TOTAL - 100);
  } else {
    fraudClock = 0;
  }

  let fraudDelivered = 0;
  for (let i = 0; i < FRAUD_BEATS.length; i++) {
    if (fraudClock >= FRAUD_BEAT_END_TIMES[i]) fraudDelivered = i + 1;
  }
  const activeFraudIdx = Math.min(fraudDelivered, FRAUD_BEATS.length - 1);
  const activeFraudStart =
    activeFraudIdx === 0 ? 0 : FRAUD_BEAT_END_TIMES[activeFraudIdx - 1];
  const activeFraudBeat = FRAUD_BEATS[activeFraudIdx];
  const activeFraudElapsed = Math.max(0, fraudClock - activeFraudStart);
  const activeFraudChars = Math.min(
    activeFraudBeat.text.length,
    Math.floor(activeFraudElapsed / TYPE_SPEED_MS_PER_CHAR),
  );

  // ---- what to render ----
  // Show the last 4 "past" lines (fading upward), then the active line larger.
  const pastLines: { text: string; tone: Beat["tone"] }[] = [];
  if (!pauseOnFraud) {
    const startIdx = Math.max(0, activePreIdx - 3);
    for (let i = startIdx; i < activePreIdx; i++) {
      pastLines.push({ text: PRE_FRAUD_BEATS[i].text, tone: PRE_FRAUD_BEATS[i].tone });
    }
  } else {
    // Blend: last 2 pre-fraud + fraud beats delivered so far
    const preCount = Math.max(0, preFraudDelivered - 2);
    const preSlice = PRE_FRAUD_BEATS.slice(preCount, preFraudDelivered);
    const fraudSlice = FRAUD_BEATS.slice(0, activeFraudIdx);
    const all = [
      ...preSlice.map((b) => ({ text: b.text, tone: b.tone })),
      ...fraudSlice.map((b) => ({ text: b.text, tone: b.tone })),
    ];
    pastLines.push(...all.slice(-4));
  }

  const currentText = pauseOnFraud ? activeFraudBeat.text : activePreBeat.text;
  const currentChars = pauseOnFraud ? activeFraudChars : activePreChars;
  const currentTone: Beat["tone"] = pauseOnFraud ? activeFraudBeat.tone : activePreBeat.tone;
  const currentDelivered = pauseOnFraud
    ? activeFraudElapsed >= activeFraudBeat.text.length * TYPE_SPEED_MS_PER_CHAR
    : activePreDelivered;

  // FREEZING swell — briefly (resumed + last beat)
  const showFreezingSwell = m.isResumed;

  // Counters
  const cleared = Math.min(preFraudDelivered, FRAUD_IDX);
  const scanned = 42_804_192 + cleared * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  // Ambient ledger ribbon — deterministic scrolling (5% screen, opacity-30)
  const ribbonIndex = Math.floor(elapsed / 220) % CHARGES.length;
  const ribbon = Array.from({ length: 10 }, (_, k) => CHARGES[(ribbonIndex + k) % CHARGES.length]);

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    if (cleared > 0) {
      out.push({ kind: "RUN", msg: `scoreRisk(batch: ${cleared} cleared)` });
    }
    if (m.isArmed || m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "thought interrupted · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying event log" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, cleared, m.isArmed, m.isCrashed, m.isReplaying, m.isResumed]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Reading · monologue"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        {/* Monologue canvas — 80% of canvas, big text */}
        <div className="relative flex min-h-0 flex-1 flex-col justify-end px-16 pt-14 pb-20">
          {/* past lines — fade upward */}
          <div className="flex flex-col justify-end gap-3 overflow-hidden">
            {pastLines.map((l, i) => {
              const age = pastLines.length - 1 - i;
              const opacity = Math.max(0.15, 1 - age * 0.22);
              const color = toneColor(l.tone);
              return (
                <div
                  key={`past-${i}`}
                  className={`font-mono text-3xl leading-snug transition-opacity duration-500 ${color}`}
                  style={{ opacity }}
                >
                  {l.text}
                </div>
              );
            })}
          </div>

          {/* current line — large */}
          <div
            className={`mt-8 font-mono text-5xl leading-tight tracking-tight ${toneColor(currentTone)} transition-colors duration-500`}
          >
            {currentText.slice(0, currentChars)}
            {!showFreezingSwell && (
              <span
                className={`ml-1 inline-block h-10 w-3 translate-y-1 bg-current ${
                  m.isCrashed ? "opacity-60" : currentDelivered ? "animate-pulse" : ""
                }`}
              />
            )}
          </div>

          {/* cached watermark (replay) */}
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
              m.isReplaying ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="rotate-[-12deg] rounded-xl border-2 border-sky-400/40 px-12 py-6 font-mono text-7xl font-bold uppercase tracking-[0.15em] text-sky-400/20">
              cached
            </span>
          </div>

          {/* FREEZING swell */}
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-500 ${
              showFreezingSwell ? "opacity-100 scale-100" : "opacity-0 scale-110"
            }`}
          >
            <span
              className="font-mono text-7xl font-bold uppercase tracking-[0.2em] text-red-300"
              style={{
                textShadow: "0 0 40px rgba(248,113,113,0.8)",
                animation: showFreezingSwell ? "reading-freezing-swell 1.4s ease-out forwards" : undefined,
              }}
            >
              FREEZING
            </span>
          </div>

          <style>{`
            @keyframes reading-freezing-swell {
              0% { transform: scale(0.85); opacity: 0; }
              30% { transform: scale(1.12); opacity: 1; }
              70% { transform: scale(1); opacity: 0.6; }
              100% { transform: scale(1); opacity: 0; }
            }
          `}</style>

          {/* Thought interrupted banner */}
          <div
            className={`pointer-events-none absolute top-8 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${
              m.isCrashed ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="rounded-full border border-red-500/60 bg-black/70 px-5 py-2 font-mono text-sm uppercase tracking-[0.3em] text-red-300">
              thought interrupted
            </span>
          </div>
        </div>

        {/* ambient ledger ribbon — bottom 5%, opacity-30 */}
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-10 overflow-hidden border-t border-white/5">
          <div
            className="flex h-full items-center gap-8 whitespace-nowrap px-6 opacity-30"
            style={{
              transform: `translateX(-${(elapsed / 40) % 400}px)`,
            }}
          >
            {ribbon.map((c, i) => (
              <span key={i} className="font-mono text-xs tabular-nums text-zinc-500">
                {c.time} · {c.card} · {c.merchant} · {c.amount}
              </span>
            ))}
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Thought interrupted · process killed"
          footer="Monologue cached · will continue"
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
        headline="Thought resumed."
        stat={`${FRAUD_CARD} frozen · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}

function toneColor(tone: Beat["tone"]): string {
  switch (tone) {
    case "amber":
      return "text-amber-300";
    case "red":
      return "text-red-300 font-bold";
    case "big":
      return "text-white font-bold";
    default:
      return "text-zinc-300";
  }
}
