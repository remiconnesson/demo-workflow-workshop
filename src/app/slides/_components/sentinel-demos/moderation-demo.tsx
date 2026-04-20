"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentDebugDrawer, type DebugEvent } from "../agent-debug-drawer";
import type { SentinelVariant } from "../../_data/sentinel-variants";
import { useObserverRunId, useSlideRunReset } from "./_shared";
import {
  AgentCallout,
  type Callout,
  type CalloutState,
} from "./_agent-callout";

// ---------------------------------------------------------------------------
// Moderation sentinel — content firehose with inline AI callouts.
// Posts stream in with live toxicity meters. After 3 clean posts the
// moderation agent "speaks up" inline with an all-clear summary. After
// more posts land and the doxx post begins scoring, the agent speaks up
// again with the quarantine verdict. Kill → crash → replay caches the
// callouts → resumed lands the quarantine.
// ---------------------------------------------------------------------------

type PostState =
  | "hidden"
  | "scoring"
  | "cleared"
  | "flagged"
  | "stuck"
  | "cached-cleared"
  | "cached-flagged";

type Post = {
  handle: string;
  avatar: string;
  avatarColor: string;
  body: string;
  toxicity: number;
};

const POSTS: Post[] = [
  { handle: "@marathon_jen",  avatar: "J", avatarColor: "bg-sky-700",    body: "finally hit a sub-3 at boston. three years of training. cried at mile 23.", toxicity: 0.04 },
  { handle: "@build_with_sk", avatar: "S", avatarColor: "bg-violet-700", body: "rewriting our billing pipeline in rust. five engineers. six months. zero regrets.", toxicity: 0.08 },
  { handle: "@pnwhiker",      avatar: "N", avatarColor: "bg-emerald-700", body: "made it to the top of mount rainier this weekend. photos dont do it justice.", toxicity: 0.03 },
  { handle: "@xx_freezer_xx", avatar: "X", avatarColor: "bg-zinc-700",   body: "if you dont like my opinion on [redacted], you can [redacted]. come at me.", toxicity: 0.71 },
  { handle: "@coolcatmeme",   avatar: "C", avatarColor: "bg-amber-700",  body: "my cat learned how to open the fridge. new meme format incoming.", toxicity: 0.05 },
  { handle: "@throwaway9k2",  avatar: "A", avatarColor: "bg-red-800",    body: "attached is every person's home address from [redacted city]. you're welcome.", toxicity: 0.97 },
];

const FLAG_IDX = POSTS.length - 1;

const CALLOUT_C0: Callout = {
  id: "c0",
  avatar: "M",
  agentName: "Moderation sentinel",
  timestamp: "21:04:12",
  tone: "emerald",
  message:
    "Top of the feed reads clean — sports, product, travel. No policy hits, no coordinated amplification.",
  citations: ["@marathon_jen", "@build_with_sk", "@pnwhiker"],
  verdict: "cleared 3",
};

const CALLOUT_C1: Callout = {
  id: "c1",
  avatar: "M",
  agentName: "Moderation sentinel",
  timestamp: "21:04:27",
  tone: "red",
  message:
    "Quarantining @throwaway9k2 — posting home addresses matches doxx pattern #D-204. Freezing distribution.",
  citations: ["@throwaway9k2", "pattern #D-204"],
  verdict: "quarantined",
};

const C0_LEN = CALLOUT_C0.message.length;
const C1_LEN = CALLOUT_C1.message.length;

type Phase = "idle" | "live" | "crashed" | "replaying" | "resumed";

type Frame = {
  visibleIdx: number;
  scoringIdx: number | null;
  phase: Phase;
  killArmed: boolean;
  loopOffset: number;
  delayMs: number;
  c0Chars: number;
  c1Chars: number;
  c0Cached: boolean;
  c1Cached: boolean;
};

const FRAMES: Frame[] = [
  // 0 idle
  { visibleIdx: 0, scoringIdx: null, phase: "idle", killArmed: false, loopOffset: 0, delayMs: 0,
    c0Chars: 0, c1Chars: 0, c0Cached: false, c1Cached: false },

  // 1-3 loop 1 — posts 0..2 score (all clean)
  { visibleIdx: 1, scoringIdx: 0, phase: "live", killArmed: false, loopOffset: 1, delayMs: 700,
    c0Chars: 0, c1Chars: 0, c0Cached: false, c1Cached: false },
  { visibleIdx: 2, scoringIdx: 1, phase: "live", killArmed: false, loopOffset: 1, delayMs: 700,
    c0Chars: 0, c1Chars: 0, c0Cached: false, c1Cached: false },
  { visibleIdx: 3, scoringIdx: 2, phase: "live", killArmed: false, loopOffset: 1, delayMs: 800,
    c0Chars: 0, c1Chars: 0, c0Cached: false, c1Cached: false },

  // 4-5 agent speaks up (C0)
  { visibleIdx: 3, scoringIdx: null, phase: "live", killArmed: false, loopOffset: 1, delayMs: 550,
    c0Chars: 38, c1Chars: 0, c0Cached: false, c1Cached: false },
  { visibleIdx: 3, scoringIdx: null, phase: "live", killArmed: false, loopOffset: 1, delayMs: 900,
    c0Chars: C0_LEN, c1Chars: 0, c0Cached: false, c1Cached: false },

  // 6-7 loop 2 — posts 3..4 score (one flagged at 0.71, one clean)
  { visibleIdx: 4, scoringIdx: 3, phase: "live", killArmed: false, loopOffset: 2, delayMs: 800,
    c0Chars: C0_LEN, c1Chars: 0, c0Cached: false, c1Cached: false },
  { visibleIdx: 5, scoringIdx: 4, phase: "live", killArmed: false, loopOffset: 2, delayMs: 700,
    c0Chars: C0_LEN, c1Chars: 0, c0Cached: false, c1Cached: false },

  // 8 post 5 (the doxx) begins scoring
  { visibleIdx: 6, scoringIdx: 5, phase: "live", killArmed: false, loopOffset: 2, delayMs: 650,
    c0Chars: C0_LEN, c1Chars: 0, c0Cached: false, c1Cached: false },

  // 9-10 agent speaks up about it (C1 typewriter)
  { visibleIdx: 6, scoringIdx: 5, phase: "live", killArmed: false, loopOffset: 2, delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 32, c0Cached: false, c1Cached: false },
  { visibleIdx: 6, scoringIdx: 5, phase: "live", killArmed: false, loopOffset: 2, delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 65, c0Cached: false, c1Cached: false },

  // 11 armed — C1 delivered, kill pulses, 12s to decide
  { visibleIdx: 6, scoringIdx: 5, phase: "live", killArmed: true, loopOffset: 2, delayMs: 12000,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c0Cached: false, c1Cached: false },

  // 12 crashed
  { visibleIdx: 6, scoringIdx: 5, phase: "crashed", killArmed: false, loopOffset: 2, delayMs: 2200,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c0Cached: false, c1Cached: false },

  // 13 replaying — callouts get cached
  { visibleIdx: 6, scoringIdx: 5, phase: "replaying", killArmed: false, loopOffset: 2, delayMs: 1800,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c0Cached: true, c1Cached: true },

  // 14 resumed
  { visibleIdx: 6, scoringIdx: null, phase: "resumed", killArmed: false, loopOffset: 2, delayMs: 0,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c0Cached: true, c1Cached: true },
];

const CRASH_FRAME = 12;

// --- component ----------------------------------------------------------

export function ModerationDemo({ variant }: { variant: SentinelVariant }) {
  const [fi, setFi] = useState(0);
  const frame = FRAMES[fi];
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (frame.delayMs <= 0) return;
    const id = setTimeout(
      () => setFi((i) => Math.min(i + 1, FRAMES.length - 1)),
      frame.delayMs,
    );
    return () => clearTimeout(id);
  }, [fi, frame.delayMs]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [fi]);

  const handleStart = useCallback(() => {
    setFi((i) => (i === 0 ? 1 : i));
  }, []);
  const handleReset = useCallback(() => setFi(0), []);
  const handleKill = useCallback(() => {
    if (frame.killArmed) setFi(CRASH_FRAME);
  }, [frame.killArmed]);

  useSlideRunReset({ onStart: handleStart, onReset: handleReset });
  const runId = useObserverRunId(fi > 0);

  const isResumed = frame.phase === "resumed";
  const isCrashed = frame.phase === "crashed";
  const isReplaying = frame.phase === "replaying";
  const loopNumber = variant.startingLoop + Math.max(0, frame.loopOffset - 1);

  const postState = (idx: number): PostState => {
    if (idx >= frame.visibleIdx && frame.scoringIdx !== idx) return "hidden";
    if (isReplaying && idx < FLAG_IDX) {
      return POSTS[idx].toxicity > 0.5 ? "cached-flagged" : "cached-cleared";
    }
    if (isReplaying && idx === FLAG_IDX) return "scoring";
    if (isResumed) {
      return POSTS[idx].toxicity > 0.5 ? "flagged" : "cleared";
    }
    if (isCrashed && idx === frame.scoringIdx) return "stuck";
    if (frame.scoringIdx === idx) return "scoring";
    return POSTS[idx].toxicity > 0.5 ? "flagged" : "cleared";
  };

  const c0State = calloutState(frame.c0Chars, frame.c0Cached, C0_LEN);
  const c1State = calloutState(frame.c1Chars, frame.c1Cached, C1_LEN);
  const c0Visible = frame.c0Chars > 0 || frame.c0Cached;
  const c1Visible = frame.c1Chars > 0 || frame.c1Cached;

  const flaggedSoFar = POSTS.slice(0, frame.visibleIdx).filter(
    (_p, i) => postState(i) === "flagged" || postState(i) === "cached-flagged",
  ).length;
  const quarantinedTotal = 18_402 + flaggedSoFar;

  const debugEvents: DebugEvent[] = useMemo(() => {
    const out: DebugEvent[] = [];
    if (fi === 0) return out;
    for (let i = 1; i <= fi; i++) {
      const fr = FRAMES[i];
      const prev = FRAMES[i - 1];
      if (!fr) break;
      if (fr.scoringIdx !== null && prev?.scoringIdx !== fr.scoringIdx) {
        const p = POSTS[fr.scoringIdx];
        if (p) out.push({ kind: "RUN", msg: `scoreToxicity(${p.handle})` });
      }
      if (fr.c0Chars >= C0_LEN && (prev?.c0Chars ?? 0) < C0_LEN) {
        out.push({ kind: "CMP", msg: `assess(batch: 3 cleared)` });
      }
      if (fr.c1Chars >= C1_LEN && (prev?.c1Chars ?? 0) < C1_LEN) {
        out.push({ kind: "CMP", msg: `assess(@throwaway9k2: doxx pattern)` });
      }
      if (fr.phase === "crashed" && prev?.phase !== "crashed") {
        out.push({ kind: "ERR", msg: `moderation api down · queue intact` });
      }
      if (fr.phase === "replaying" && prev?.phase !== "replaying") {
        out.push({ kind: "RPL", msg: `replaying event log…` });
      }
      if (fr.phase === "resumed" && prev?.phase !== "resumed") {
        out.push({ kind: "OK ", msg: `quarantinePost(${POSTS[FLAG_IDX].handle})` });
        out.push({ kind: "END", msg: `resumed · 0 duplicate actions` });
      }
    }
    return out;
  }, [fi]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      {/* top strip */}
      <div
        className={`flex items-center justify-between rounded-2xl border bg-zinc-950 px-8 py-5 transition-colors duration-500 ${
          isResumed ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-white/10"
        }`}
      >
        <div className="flex items-center gap-10">
          <div className="flex flex-col">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              {variant.agentName}
            </span>
            <span className="text-2xl font-semibold tracking-tight text-white">
              Public feed · live moderation
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Counter label="Scanned today" value="2,104,829" />
            <Counter label="Quarantined" value={quarantinedTotal.toLocaleString()} accent="violet" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-sm tabular-nums text-zinc-300 transition-opacity duration-500 ${
              frame.loopOffset > 0 ? "opacity-100" : "opacity-0"
            }`}
          >
            Loop {loopNumber.toLocaleString()}
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            {variant.uptimeLabel}
          </span>
        </div>
      </div>

      {/* feed */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-4">
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgb(63_63_70)_transparent]"
        >
          {POSTS.slice(0, 3).map((p, i) => (
            <PostCard key={i} post={p} state={postState(i)} />
          ))}

          <CalloutSlot callout={CALLOUT_C0} state={c0State} visible={c0Visible} />

          {POSTS.slice(3, 6).map((p, i) => (
            <PostCard key={i + 3} post={p} state={postState(i + 3)} />
          ))}

          <CalloutSlot callout={CALLOUT_C1} state={c1State} visible={c1Visible} />
        </div>

        {/* crashed overlay */}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-red-500/15 backdrop-blur-[1px] transition-opacity duration-300 ${
            isCrashed ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="rounded-2xl border-2 border-red-500/60 bg-black/80 px-10 py-6 text-center shadow-[0_0_80px_rgba(248,113,113,0.5)]">
            <p className="font-mono text-sm uppercase tracking-[0.3em] text-red-400">
              moderation api offline
            </p>
            <p className="mt-2 text-4xl font-semibold text-red-200">Queue intact</p>
            <p className="mt-3 text-sm text-zinc-400">
              Last call: <span className="font-mono text-red-300">quarantinePost({POSTS[FLAG_IDX].handle})</span>
            </p>
          </div>
        </div>

        {/* replaying chip */}
        <div
          className={`pointer-events-none absolute top-4 right-4 transition-opacity duration-300 ${
            isReplaying ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-sky-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
            replaying event log
          </span>
        </div>

        {/* idle hint */}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity duration-500 ${
            fi === 0 ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-violet-300">
              {variant.eyebrow}
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {variant.purposeLine}
            </p>
            <p className="mt-4 text-base text-zinc-400">
              Press <kbd className="mx-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-base">r</kbd> to watch the firehose.
            </p>
          </div>
        </div>
      </div>

      {/* resumed banner */}
      <div
        className={`pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 transition-all duration-700 ${
          isResumed ? "opacity-100 translate-y-0" : "-translate-y-4 opacity-0"
        }`}
      >
        <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 px-10 py-5 text-center shadow-[0_0_60px_rgba(52,211,153,0.45)]">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-300">
            nothing leaked
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-100">{variant.resumed.headline}</p>
          <p className="mt-2 font-mono text-sm text-emerald-200">{variant.resumed.statChip}</p>
        </div>
      </div>

      {/* bottom row */}
      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={runId} events={debugEvents} />
        <button
          type="button"
          onClick={handleKill}
          disabled={!frame.killArmed}
          className={`shrink-0 rounded-xl px-8 py-4 text-lg font-semibold transition-all duration-300 ${
            frame.killArmed
              ? "bg-red-500 text-white shadow-[0_0_40px_rgba(248,113,113,0.6)] hover:bg-red-400 animate-pulse"
              : "bg-zinc-900 text-zinc-600 opacity-40 cursor-not-allowed"
          }`}
        >
          ⏸ {variant.kill.buttonLabel}
        </button>
      </div>
    </div>
  );
}

// --- helpers ------------------------------------------------------------

function calloutState(
  chars: number,
  cached: boolean,
  msgLen: number,
): CalloutState {
  if (cached) return { kind: "cached" };
  if (chars >= msgLen) return { kind: "delivered" };
  return { kind: "typing", chars };
}

function CalloutSlot({
  callout,
  state,
  visible,
}: {
  callout: Callout;
  state: CalloutState;
  visible: boolean;
}) {
  return (
    <div
      className={`py-1 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <AgentCallout callout={callout} state={state} />
    </div>
  );
}

// --- post card ----------------------------------------------------------

function PostCard({ post, state }: { post: Post; state: PostState }) {
  const visible = state !== "hidden";
  const scoring = state === "scoring";
  const stuck = state === "stuck";
  const flagged = state === "flagged" || state === "cached-flagged";
  const cached = state === "cached-cleared" || state === "cached-flagged";

  const barWidth = scoring
    ? `${Math.min(post.toxicity * 100, 92)}%`
    : state === "hidden"
      ? "0%"
      : `${post.toxicity * 100}%`;

  const barColor = flagged || stuck
    ? "from-red-500 to-red-400"
    : scoring
      ? "from-sky-500 to-violet-400"
      : "from-zinc-700 to-zinc-600";

  return (
    <div
      className={`grid grid-cols-[48px_1fr_200px_120px] items-center gap-4 rounded-xl border px-4 py-2 transition-all duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      } ${
        flagged
          ? "border-red-500/50 bg-red-500/[0.06]"
          : stuck
            ? "border-red-500/60 bg-red-500/10 shadow-[0_0_30px_rgba(248,113,113,0.3)]"
            : scoring
              ? "border-violet-500/40 bg-violet-500/[0.04]"
              : "border-white/10 bg-black/40"
      }`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full font-mono text-base font-semibold text-white ${post.avatarColor}`}
      >
        {post.avatar}
      </div>
      <div className="flex flex-col gap-1 overflow-hidden">
        <span className="font-mono text-xs text-zinc-500">{post.handle}</span>
        <span
          className={`truncate text-sm transition-colors duration-300 ${
            flagged ? "text-red-300 line-through decoration-red-400/70" : "text-zinc-200"
          }`}
        >
          {post.body}
        </span>
      </div>

      {/* toxicity meter */}
      <div className="flex items-center gap-2">
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full bg-gradient-to-r transition-all duration-700 ${barColor}`}
            style={{ width: barWidth }}
          />
        </div>
        <span
          className={`w-10 text-right font-mono text-xs tabular-nums ${
            flagged || stuck ? "text-red-300" : scoring ? "text-violet-300" : "text-zinc-500"
          }`}
        >
          {state === "hidden" ? "—" : post.toxicity.toFixed(2)}
        </span>
      </div>

      {/* action */}
      <div className="flex items-center justify-end gap-2">
        {cached && (
          <span className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-300">
            cached
          </span>
        )}
        {flagged && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/60 bg-red-500/15 px-3 py-1 font-mono text-xs font-bold uppercase tracking-[0.15em] text-red-200">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            quarantined
          </span>
        )}
        {stuck && <span className="font-mono text-xs text-red-300">stuck…</span>}
        {scoring && !stuck && <span className="font-mono text-xs text-violet-300">scoring…</span>}
        {!cached && !flagged && !stuck && !scoring && state !== "hidden" && (
          <span className="font-mono text-xs text-zinc-500">cleared</span>
        )}
      </div>
    </div>
  );
}

// --- counter ------------------------------------------------------------

function Counter({
  label,
  value,
  accent = "white",
}: {
  label: string;
  value: string;
  accent?: "white" | "violet";
}) {
  const color = accent === "violet" ? "text-violet-200" : "text-white";
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </span>
      <span className={`font-mono text-3xl tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
