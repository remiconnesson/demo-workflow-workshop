"use client";

// ---------------------------------------------------------------------------
// AgentCallout: the "AI speaks up" card used across all five sentinel
// demos. The card sits INLINE with the demo data (row-like in feed demos,
// in a side thread in spatial demos) and represents a single moment where
// the agent reasoned about the data and produced a verdict.
//
// Renders:
//   • avatar initial (coloured)        . stable identity for the agent
//   • agent name + state dot           . current thinking state
//   • timestamp                        . monospace, dim
//   • message                          . 1-2 sentence prose, optional typewriter
//   • inline citation chips            . cite specific IDs in the data above
//   • verdict tag                      . past-tense action, strong colour
//   • "cached" sigil                   . appears on replay to show persistence
// ---------------------------------------------------------------------------

export type CalloutTone = "sky" | "violet" | "amber" | "red" | "emerald";

export type Callout = {
  id: string;
  avatar: string;          // single letter
  agentName: string;       // "Sentinel", "Observer"
  timestamp: string;       // "12:48:03"
  tone: CalloutTone;       // overall accent for verdict + avatar
  message: string;         // 1–2 sentences
  citations?: string[];    // short IDs shown as inline chips
  verdict?: string;        // past-tense action ("froze", "paged")
};

export type CalloutState =
  | { kind: "typing"; chars: number }
  | { kind: "delivered" }
  | { kind: "cached" };

const AVATAR_BG: Record<CalloutTone, string> = {
  sky:     "bg-sky-500/20 text-sky-200 border-sky-400/50",
  violet:  "bg-violet-500/20 text-violet-200 border-violet-400/50",
  amber:   "bg-amber-500/20 text-amber-200 border-amber-400/50",
  red:     "bg-red-500/20 text-red-200 border-red-400/50",
  emerald: "bg-emerald-500/20 text-emerald-200 border-emerald-400/50",
};

const DOT_BG: Record<CalloutTone, string> = {
  sky:     "bg-sky-400",
  violet:  "bg-violet-400",
  amber:   "bg-amber-400",
  red:     "bg-red-400",
  emerald: "bg-emerald-400",
};

const VERDICT_CLS: Record<CalloutTone, string> = {
  sky:     "border-sky-500/40 bg-sky-500/15 text-sky-200",
  violet:  "border-violet-500/40 bg-violet-500/15 text-violet-200",
  amber:   "border-amber-500/40 bg-amber-500/15 text-amber-200",
  red:     "border-red-500/50 bg-red-500/15 text-red-200",
  emerald: "border-emerald-500/50 bg-emerald-500/15 text-emerald-200",
};

const CARD_BORDER: Record<CalloutTone, string> = {
  sky:     "border-sky-500/30 bg-sky-500/[0.04]",
  violet:  "border-violet-500/30 bg-violet-500/[0.04]",
  amber:   "border-amber-500/30 bg-amber-500/[0.05]",
  red:     "border-red-500/35 bg-red-500/[0.05]",
  emerald: "border-emerald-500/30 bg-emerald-500/[0.04]",
};

export function AgentCallout({
  callout,
  state,
}: {
  callout: Callout;
  state: CalloutState;
}) {
  const isTyping = state.kind === "typing";
  const isCached = state.kind === "cached";
  const charsToShow =
    state.kind === "typing" ? state.chars : callout.message.length;
  const shownMessage = callout.message.slice(0, charsToShow);
  const messageDone = charsToShow >= callout.message.length;

  return (
    <div
      className={`relative flex flex-col gap-3 rounded-xl border-l-4 border-l-${toneFill(
        callout.tone,
      )} border-y border-r px-4 py-3 transition-colors duration-300 ${
        CARD_BORDER[callout.tone]
      }`}
      style={{ borderLeftColor: toneHex(callout.tone) }}
    >
      {/* cached sigil */}
      {isCached && (
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-300">
          <span className="h-1 w-1 rounded-full bg-emerald-400" />
          cached
        </span>
      )}

      {/* header */}
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-semibold ${
            AVATAR_BG[callout.tone]
          }`}
        >
          {callout.avatar}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-sm font-semibold text-white">
            {callout.agentName}
          </span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${DOT_BG[callout.tone]} ${
              isTyping ? "animate-pulse" : ""
            }`}
          />
          <span className="text-[11px] text-zinc-500">
            {isTyping ? "reasoning…" : messageDone ? "delivered" : "…"}
          </span>
          <span className="ml-auto font-mono text-[11px] text-zinc-500">
            {callout.timestamp}
          </span>
        </div>
      </div>

      {/* message */}
      <p className="text-lg leading-snug text-zinc-100">
        {shownMessage}
        {isTyping && !messageDone && (
          <span className="ml-0.5 animate-pulse text-zinc-400">▍</span>
        )}
      </p>

      {/* citations + verdict */}
      {messageDone && (callout.citations?.length || callout.verdict) && (
        <div className="flex flex-wrap items-center gap-2">
          {callout.citations?.map((c, i) => (
            <span
              key={i}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-xs text-zinc-300"
            >
              → {c}
            </span>
          ))}
          {callout.verdict && (
            <span
              className={`ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs font-bold uppercase tracking-[0.18em] ${
                VERDICT_CLS[callout.tone]
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${DOT_BG[callout.tone]}`} />
              {callout.verdict}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function toneFill(tone: CalloutTone): string {
  // dummy, replaced by explicit hex below. We keep the class name
  // so dynamic border-l-* isn't purged if someone inspects the element.
  return tone;
}

function toneHex(tone: CalloutTone): string {
  switch (tone) {
    case "sky":     return "rgb(56 189 248)";
    case "violet":  return "rgb(167 139 250)";
    case "amber":   return "rgb(251 191 36)";
    case "red":     return "rgb(248 113 113)";
    case "emerald": return "rgb(52 211 153)";
  }
}
