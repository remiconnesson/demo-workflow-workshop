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
// Variant 24 · The Book
// Open leather-bound book. Left page: pre-rendered charge ledger (opacity
// reveals as ticks advance — no reflow). Right page: quill writes one line
// per charge, character-by-character. On the fraud frame the quill stops
// mid-line and writes "I don't know this one." in red italic. Kill: book
// slams shut (right page rotateY). Replay: book opens again, red line still
// there. Resume: emerald banner.
// ---------------------------------------------------------------------------

const FRAUD_IDX = CHARGES.length - 1;
const LINE_CADENCE_MS = 700; // per-line pacing
const CHAR_MS = 22;          // per-char typing pacing

const UNKNOWN_LINE = "I don't know this one.";

// Build a verdict string for each non-fraud charge. Kept short for a single
// monospace line that fits the right page width.
function verdictFor(idx: number): string {
  const c = CHARGES[idx];
  return `${c.time}  ${c.card}  ${c.merchant.padEnd(18).slice(0, 18)}  ${c.amount.padStart(10)}  cleared`;
}

export function BookDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 7_500,
    crashHoldMs: 2_400,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  // Line index: how far we've gotten typing. 0..FRAUD_IDX for normal lines;
  // FRAUD_IDX represents the halted fraud line replaced with UNKNOWN_LINE.
  const rawLine = Math.floor(elapsed / LINE_CADENCE_MS);
  const locked = m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;
  const lineIdx = locked ? FRAUD_IDX : Math.min(rawLine, FRAUD_IDX);
  const atFraud = locked;

  // character count of the currently-typing line
  const lineStart = lineIdx * LINE_CADENCE_MS;
  const sinceLine = Math.max(0, elapsed - lineStart);
  const currentText = atFraud ? UNKNOWN_LINE : verdictFor(lineIdx);
  // Typing for the current line. When locked at FRAUD_IDX, type the unknown
  // line from zero up to full length; hold at full length once reached.
  const typingLen = atFraud
    ? Math.min(UNKNOWN_LINE.length, Math.floor(sinceLine / CHAR_MS))
    : Math.min(currentText.length, Math.floor(sinceLine / CHAR_MS));
  const visibleText = currentText.slice(0, typingLen);

  const scanned = 42_804_192 + Math.min(lineIdx + (atFraud ? 1 : 0), CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scribe(open: 94d journal)" });
    out.push({ kind: "RUN", msg: `write(line: ${lineIdx + 1})` });
    if (atFraud) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: unknown)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed) out.push({ kind: "ERR", msg: "book slammed shut" });
    if (m.isReplaying) out.push({ kind: "RPL", msg: "page re-opened · ink cached" });
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, lineIdx, atFraud, m.isCrashed, m.isReplaying, m.isResumed]);

  // When crashed, the right page rotates closed onto the left.
  const bookClosed = m.isCrashed;

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="The book · scribe"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(36,22,10,1) 0%, rgba(14,8,4,1) 70%, rgba(0,0,0,1) 100%)",
        }}
      >
        {/* scope labels */}
        <div className="pointer-events-none absolute top-6 left-8 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-200/60">
            scribe · chapter 94
          </span>
          <span
            className={`font-mono text-3xl tabular-nums transition-colors duration-300 ${
              atFraud ? "text-red-300" : "text-amber-200"
            }`}
          >
            {atFraud ? "PAUSED" : `line ${lineIdx + 1} / ${FRAUD_IDX + 1}`}
          </span>
        </div>
        <div className="pointer-events-none absolute top-6 right-8 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-200/60">
            elapsed
          </span>
          <span className="font-mono text-3xl tabular-nums text-amber-100/80">
            {Math.floor(elapsed / 1000).toString().padStart(2, "0")}
            :
            {Math.floor((elapsed / 10) % 100).toString().padStart(2, "0")}
          </span>
        </div>

        {/* book */}
        <div className="absolute inset-0 flex items-center justify-center px-6 pt-20 pb-16">
          <div
            className="relative h-full w-full max-h-[540px] max-w-[1100px]"
            style={{ perspective: "2400px" }}
          >
            {/* spine shadow */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-6 -translate-x-1/2 z-10"
              style={{
                background:
                  "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0) 100%)",
              }}
            />

            {/* LEFT page (pre-rendered ledger) */}
            <BookPage side="left" bookClosed={false}>
              <div className="flex h-full flex-col gap-3 px-10 py-8">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-900/70">
                  ledger · day 94
                </span>
                <div className="flex flex-1 flex-col gap-1.5 overflow-hidden font-mono text-[12px] leading-snug text-amber-900">
                  {CHARGES.map((c, i) => {
                    const revealed = i < lineIdx || (i === lineIdx && typingLen > 0) || atFraud;
                    return (
                      <div
                        key={i}
                        className="flex gap-2 transition-opacity duration-500"
                        style={{ opacity: revealed ? 0.88 : 0.22 }}
                      >
                        <span className="w-14 tabular-nums">{c.time}</span>
                        <span className="w-16">{c.card}</span>
                        <span className="flex-1 truncate">{c.merchant}</span>
                        <span className="w-16 text-right tabular-nums">{c.amount}</span>
                        <span className="w-6 text-right">{c.country}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-end justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-900/60">
                    folio
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-amber-900/60">
                    {(94).toString().padStart(2, "0")}
                  </span>
                </div>
              </div>
            </BookPage>

            {/* RIGHT page (quill scribbles verdicts) */}
            <BookPage side="right" bookClosed={bookClosed}>
              <div className="relative flex h-full flex-col gap-3 px-10 py-8">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-900/70">
                  verdict · scribe&apos;s hand
                </span>
                <div className="flex flex-1 flex-col gap-1.5 overflow-hidden font-mono text-[12px] leading-snug">
                  {/* pre-rendered completed verdicts */}
                  {CHARGES.slice(0, FRAUD_IDX).map((_, i) => {
                    const done = i < lineIdx;
                    return (
                      <div
                        key={i}
                        className="transition-opacity duration-500 text-amber-900"
                        style={{ opacity: done ? 0.88 : 0 }}
                      >
                        {verdictFor(i)}
                      </div>
                    );
                  })}

                  {/* current typing line */}
                  <div
                    className={`transition-colors duration-300 ${
                      atFraud ? "italic text-red-700" : "text-amber-900"
                    }`}
                  >
                    {visibleText}
                    <span
                      className={`ml-0.5 inline-block h-[14px] w-[2px] align-[-2px] ${
                        atFraud ? "bg-red-600" : "bg-amber-900/80"
                      }`}
                      style={{ animation: "bookCaret 900ms steps(2) infinite" }}
                    />
                  </div>

                  {/* cached sigil when replaying */}
                  <div
                    className="mt-1 transition-opacity duration-500"
                    style={{ opacity: m.isReplaying || m.isResumed ? 1 : 0 }}
                  >
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-600/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-700">
                      cached · not re-executed
                    </span>
                  </div>
                </div>

                {/* quill */}
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: `calc(40px + ${Math.min(typingLen, 56) * 7}px)`,
                    top: `${64 + Math.min(lineIdx, FRAUD_IDX) * 20}px`,
                    transition: "left 120ms linear, top 400ms ease",
                  }}
                >
                  <svg viewBox="0 0 60 80" className="h-20 w-14">
                    {/* feather */}
                    <path
                      d="M 30 4 Q 14 20 10 40 Q 14 56 24 60 L 34 48 Q 40 28 30 4 Z"
                      fill={atFraud ? "rgb(220,38,38)" : "rgb(212,175,55)"}
                      opacity="0.85"
                      stroke="rgba(0,0,0,0.35)"
                      strokeWidth="0.6"
                    />
                    <path d="M 30 8 L 26 58" stroke="rgba(0,0,0,0.4)" strokeWidth="0.4" />
                    {/* nib */}
                    <path
                      d="M 24 60 L 28 76 L 32 60 Z"
                      fill={atFraud ? "rgb(127,29,29)" : "rgb(40,24,10)"}
                    />
                  </svg>
                </div>

                <div className="flex items-end justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-900/60">
                    folio
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-amber-900/60">
                    {(95).toString().padStart(2, "0")}
                  </span>
                </div>

                <style>{`
                  @keyframes bookCaret {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0; }
                  }
                `}</style>
              </div>
            </BookPage>
          </div>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Book slammed shut"
          footer="Event log intact · last ink cached"
        />
        <ReplayingChip active={m.isReplaying} />
        <IdleHint
          eyebrow="fraud sentinel · always on"
          purpose="94 chapters. One unknown."
          active={!m.active}
        />
      </div>

      <ResumedBanner
        active={m.isResumed}
        headline="94 chapters · 1 unknown, handed to a human."
        stat={`${FRAUD_CARD} · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BookPage — absolutely positioned half, with aged paper background. Right
// page flips closed via rotateY when bookClosed=true.
// ---------------------------------------------------------------------------

function BookPage({
  side,
  bookClosed,
  children,
}: {
  side: "left" | "right";
  bookClosed: boolean;
  children: React.ReactNode;
}) {
  const isLeft = side === "left";
  return (
    <div
      className="absolute top-0 bottom-0 w-1/2"
      style={{
        left: isLeft ? 0 : "50%",
        transformStyle: "preserve-3d",
        transformOrigin: isLeft ? "right center" : "left center",
        transform: !isLeft && bookClosed ? "rotateY(-168deg)" : "rotateY(0deg)",
        transition: "transform 600ms cubic-bezier(.4,.1,.3,1)",
      }}
    >
      <div
        className="h-full w-full overflow-hidden border border-amber-900/40 shadow-[inset_0_0_60px_rgba(92,57,20,0.35)]"
        style={{
          borderRadius: isLeft ? "12px 4px 4px 12px" : "4px 12px 12px 4px",
          background:
            "linear-gradient(180deg, rgb(244,228,188) 0%, rgb(232,210,156) 50%, rgb(214,188,128) 100%)",
          filter: bookClosed && !isLeft ? "brightness(0.35)" : "none",
          transition: "filter 400ms ease",
        }}
      >
        {/* paper grain */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(92,57,20,0.04) 0 1px, transparent 1px 3px), radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.2) 0%, rgba(92,57,20,0) 60%)",
          }}
        />
        {children}
      </div>
    </div>
  );
}
