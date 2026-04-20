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
// Variant 07 · Courtroom
// A single "defendant" card rotates under a gavel silhouette in a spotlight.
// The agent's reasoning streams out below as verdict lines. On fraud the
// reasoning grows amber, then amber, then red; final line is bold red
// "I cannot explain this pattern." The gavel flashes, the card is stamped
// FROZEN. On crash the text halts mid-sentence. On replay the transcript
// catches up as "cached". On resume, the bailiff's stamp is final.
// ---------------------------------------------------------------------------

const FRAUD_IDX = CHARGES.length - 1;

// Verdict lines per charge — first few are neutral, fraud row gets a full
// escalating monologue.
type LineTone = "neutral" | "amber" | "red" | "final";
type Line = { text: string; tone: LineTone };

function linesFor(i: number): Line[] {
  const c = CHARGES[i];
  if (i === FRAUD_IDX) {
    return [
      { text: `Counsel, the charge is ${c.card} at ${c.merchant}.`, tone: "neutral" },
      { text: `merchant: ${c.merchant.toLowerCase()} · no record in 94 days.`, tone: "amber" },
      { text: `geography: ${c.country} · card has never charged abroad.`, tone: "amber" },
      { text: `amount: ${c.amount} · 3× typical for this card.`, tone: "red" },
      { text: "I cannot explain this pattern.", tone: "final" },
    ];
  }
  return [
    { text: `${c.card} at ${c.merchant} · ${c.amount}.`, tone: "neutral" },
    { text: `history: familiar merchant, low risk · cleared.`, tone: "neutral" },
  ];
}

const LINE_MS = 650; // how long each line "types out"
const ROW_MS = 1_800; // rotate to next charge (non-fraud)
const PRE_FRAUD_MS = ROW_MS * (FRAUD_IDX); // roughly when fraud appears

export function CourtroomDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_000,
    crashHoldMs: 2_200,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  // Determine which charge we're currently on (stays on fraud once reached).
  const rawIdx = Math.floor(elapsed / ROW_MS);
  const pauseOnFraud =
    m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;
  const idx = pauseOnFraud ? FRAUD_IDX : Math.min(rawIdx, FRAUD_IDX - 1);
  const currentCharge = CHARGES[idx];

  // Compute reasoning progression within the current row.
  const currentLines = linesFor(idx);
  const withinRow = pauseOnFraud
    ? Math.min(elapsed - PRE_FRAUD_MS, LINE_MS * currentLines.length + 400)
    : elapsed % ROW_MS;
  let deliveredLines = Math.floor(withinRow / LINE_MS);
  if (m.isCrashed) {
    // freeze mid final-line
    deliveredLines = Math.min(deliveredLines, currentLines.length - 1);
  }
  if (m.isResumed || m.isReplaying) {
    deliveredLines = currentLines.length;
  }

  // Count of cleared so far
  const cleared = Math.min(idx, FRAUD_IDX);
  const frozenCount = 1_248 + (m.isResumed ? 1 : 0);

  const scanned = 42_804_192 + cleared * 417;
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  const stamped = m.isResumed;
  const cardRotClass = pauseOnFraud ? "" : "animate-[spin_12s_linear_infinite]";

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
      out.push({ kind: "ERR", msg: "court adjourned · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "stenographer log · replay" });
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
        title="Courtroom · verdict"
        scanned={scanned}
        frozen={frozenCount}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        {/* left tally */}
        <div className="flex w-56 shrink-0 flex-col gap-4 border-r border-white/5 px-6 py-8">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              cleared
            </span>
            <span className="font-mono text-4xl tabular-nums text-emerald-300">
              {cleared.toString().padStart(2, "0")}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              frozen
            </span>
            <span
              className={`font-mono text-4xl tabular-nums transition-colors duration-500 ${
                m.isResumed ? "text-red-300" : "text-zinc-600"
              }`}
            >
              {m.isResumed ? "01" : "00"}
            </span>
          </div>
          <div className="mt-auto flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              session
            </span>
            <span className="font-mono text-lg tabular-nums text-zinc-400">
              CH-{(STARTING_LOOP).toString().slice(-4)}
            </span>
          </div>
        </div>

        {/* center stage — spotlight */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          {/* spotlight */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 42%, rgba(253,224,71,0.09) 0%, rgba(253,224,71,0.04) 28%, rgba(0,0,0,0) 55%)",
            }}
          />

          {/* gavel silhouette above the card */}
          <div className="pointer-events-none absolute top-8 left-1/2 -translate-x-1/2">
            <svg
              viewBox="0 0 120 70"
              className={`h-16 w-32 transition-all duration-300 ${
                pauseOnFraud ? "text-red-300" : "text-white/40"
              } ${deliveredLines >= currentLines.length && pauseOnFraud ? "animate-pulse" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* wig silhouette */}
              <path d="M 10 60 Q 10 20 60 15 Q 110 20 110 60 Z" />
              <line x1="30" y1="60" x2="30" y2="30" />
              <line x1="60" y1="60" x2="60" y2="22" />
              <line x1="90" y1="60" x2="90" y2="30" />
              {/* gavel */}
              <rect x="48" y="58" width="24" height="6" rx="1.5" />
              <line x1="60" y1="64" x2="60" y2="68" />
            </svg>
          </div>

          {/* defendant card */}
          <div className="relative" style={{ perspective: "800px" }}>
            <div
              className={`relative h-56 w-80 rounded-2xl border-2 ${
                stamped ? "border-red-500/70" : "border-white/15"
              } bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-[0_0_60px_rgba(255,255,255,0.08)] ${cardRotClass}`}
              style={{
                transition: "border-color 500ms ease, box-shadow 500ms ease",
                transformStyle: "preserve-3d",
              }}
            >
              <div className="flex h-full flex-col justify-between p-6">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                    exhibit A
                  </span>
                  <span
                    className={`h-3 w-3 rounded-full transition-colors duration-300 ${
                      pauseOnFraud ? "bg-red-400 animate-pulse" : "bg-emerald-400/70"
                    }`}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-3xl tabular-nums text-white">
                    {currentCharge.card}
                  </span>
                  <span className="truncate font-sans text-xl text-zinc-200">
                    {currentCharge.merchant}
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-2xl tabular-nums text-zinc-100">
                      {currentCharge.amount}
                    </span>
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-xs ${
                        currentCharge.country === "US"
                          ? "border-zinc-700 text-zinc-400"
                          : "border-red-500/60 text-red-300"
                      }`}
                    >
                      {currentCharge.country}
                    </span>
                  </div>
                </div>
              </div>

              {/* FROZEN stamp */}
              <div
                className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-500 ${
                  stamped ? "opacity-100 scale-100" : "opacity-0 scale-125"
                }`}
              >
                <span className="rotate-[-12deg] rounded-lg border-4 border-red-500/80 bg-red-500/15 px-6 py-2 font-mono text-4xl font-bold uppercase tracking-[0.2em] text-red-300 shadow-[0_0_30px_rgba(248,113,113,0.5)]">
                  frozen
                </span>
              </div>
            </div>
          </div>

          {/* reasoning transcript below the card */}
          <div className="absolute right-10 bottom-8 left-10 flex h-28 flex-col justify-end gap-1 overflow-hidden">
            {currentLines.map((l, i) => {
              const isCurrent = i === Math.min(deliveredLines, currentLines.length - 1);
              const revealed = i <= deliveredLines;
              const typingChars = isCurrent && !m.isResumed && !m.isReplaying
                ? Math.min(
                    l.text.length,
                    Math.floor(((withinRow % LINE_MS) / LINE_MS) * l.text.length),
                  )
                : l.text.length;
              const shownText = revealed
                ? isCurrent
                  ? l.text.slice(0, typingChars)
                  : l.text
                : "";
              const color =
                l.tone === "final"
                  ? "text-red-300 font-bold"
                  : l.tone === "red"
                    ? "text-red-300"
                    : l.tone === "amber"
                      ? "text-amber-300"
                      : "text-zinc-400";
              return (
                <div
                  key={i}
                  className={`font-mono text-base leading-6 transition-opacity duration-300 ${
                    revealed ? "opacity-100" : "opacity-0"
                  } ${color}`}
                >
                  {shownText}
                  {isCurrent && revealed && !m.isResumed && (
                    <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 bg-current opacity-70" />
                  )}
                </div>
              );
            })}
          </div>

          {/* court adjourned banner */}
          <div
            className={`pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${
              m.isCrashed ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="rounded-full border border-red-500/60 bg-black/70 px-5 py-2 font-mono text-xs uppercase tracking-[0.3em] text-red-300">
              court adjourned · stenographer notes intact
            </span>
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Court adjourned · process killed"
          footer="Stenographer notes intact"
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
        headline="Verdict stands."
        stat={`${FRAUD_CARD} frozen · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
