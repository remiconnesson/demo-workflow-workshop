"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentDebugDrawer, type DebugEvent } from "../agent-debug-drawer";
import type { SentinelVariant } from "../../_data/sentinel-variants";
import { useObserverRunId, useSlideRunReset } from "./_shared";
import {
  AgentCallout,
  type Callout,
  type CalloutState,
} from "./_agent-callout";

// ---------------------------------------------------------------------------
// CVE auto-patcher: three-column triage board + agent thread.
// Col 1: running deployments. Col 2: CVE matches. Col 3: AI thread above
// the PR card. The patcher agent announces scan, draft, and merge as
// separate speech cards. PR title types char-by-char and freezes mid-word
// on crash. Replay caches the thread and completes the typing + merge.
// ---------------------------------------------------------------------------

type Phase = "idle" | "scanning" | "matched" | "typing" | "crashed" | "replaying" | "resumed";

type Service = {
  name: string;
  pkg: string;
  version: string;
};

const SERVICES: Service[] = [
  { name: "api-gateway",     pkg: "@openai",       version: "4.20.0" },
  { name: "checkout-svc",    pkg: "stripe",        version: "14.11.0" },
  { name: "order-ingest",    pkg: "@openai",       version: "4.20.0" },
  { name: "billing-worker",  pkg: "lodash",        version: "4.17.19" },
  { name: "notifier",        pkg: "axios",         version: "1.6.2" },
  { name: "analytics-sink",  pkg: "@openai",       version: "4.20.0" },
];

type CveCard = {
  id: string;
  pkg: string;
  fixVersion: string;
  severity: "high" | "medium";
};

const CVES: CveCard[] = [
  { id: "CVE-2026-18442", pkg: "@openai", fixVersion: "4.20.1", severity: "high" },
  { id: "CVE-2026-17920", pkg: "lodash",  fixVersion: "4.17.21", severity: "medium" },
];

const MATCHED_SERVICE_IDXS = [0, 2, 5];

const PR_TITLE = "bump @openai 4.20.0 → 4.20.1 (CVE-2026-18442)";
const CRASH_CHAR_COUNT = 22;
const DIFF_LINES = [
  { kind: "meta", text: "diff --git a/package.json b/package.json" },
  { kind: "-",    text: '-    "@openai": "4.20.0",' },
  { kind: "+",    text: '+    "@openai": "4.20.1",' },
  { kind: "meta", text: "diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml" },
  { kind: "-",    text: "-  '@openai@4.20.0':" },
  { kind: "+",    text: "+  '@openai@4.20.1':" },
] as const;

const CALLOUT_C0: Callout = {
  id: "c0",
  avatar: "P",
  agentName: "Patcher",
  timestamp: "03:14:02",
  tone: "sky",
  message:
    "Scanned 6 services. 3 running @openai 4.20.0 match CVE-2026-18442 (severity high).",
  citations: ["api-gateway", "order-ingest", "analytics-sink"],
  verdict: "3 matches",
};

const CALLOUT_C1: Callout = {
  id: "c1",
  avatar: "P",
  agentName: "Patcher",
  timestamp: "03:14:07",
  tone: "violet",
  message:
    "Drafting PR against main: bumping @openai across 3 services, updating lockfile, pushing cve/openai-4.20.1.",
  citations: ["main", "cve/openai-4.20.1"],
  verdict: "PR draft",
};

const CALLOUT_C2: Callout = {
  id: "c2",
  avatar: "P",
  agentName: "Patcher",
  timestamp: "03:14:23",
  tone: "emerald",
  message:
    "Merged #9182 into main. CI green, branch deleted. All 3 services now on @openai 4.20.1.",
  citations: ["#9182", "main"],
  verdict: "auto-merged",
};

const C0_LEN = CALLOUT_C0.message.length;
const C1_LEN = CALLOUT_C1.message.length;
const C2_LEN = CALLOUT_C2.message.length;

type Frame = {
  phase: Phase;
  titleChars: number;
  diffLines: number;
  merged: boolean;
  loopOffset: number;
  killArmed: boolean;
  delayMs: number;
  c0Chars: number;
  c1Chars: number;
  c2Chars: number;
  c0Cached: boolean;
  c1Cached: boolean;
  c2Cached: boolean;
};

const BASE = { c0Chars: 0, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false };

const FRAMES: Frame[] = [
  // 0 idle
  { phase: "idle", titleChars: 0, diffLines: 0, merged: false, loopOffset: 0, killArmed: false, delayMs: 0, ...BASE },

  // 1 scanning
  { phase: "scanning", titleChars: 0, diffLines: 0, merged: false, loopOffset: 1, killArmed: false, delayMs: 900, ...BASE },

  // 2 matched: CVE arrows appear
  { phase: "matched", titleChars: 0, diffLines: 0, merged: false, loopOffset: 1, killArmed: false, delayMs: 700, ...BASE },

  // 3-4 C0 speaks up (scan findings)
  { phase: "matched", titleChars: 0, diffLines: 0, merged: false, loopOffset: 1, killArmed: false, delayMs: 500,
    c0Chars: 38, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },
  { phase: "matched", titleChars: 0, diffLines: 0, merged: false, loopOffset: 1, killArmed: false, delayMs: 850,
    c0Chars: C0_LEN, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },

  // 5-6 PR title typing begins
  { phase: "typing", titleChars: 8, diffLines: 0, merged: false, loopOffset: 1, killArmed: false, delayMs: 240,
    c0Chars: C0_LEN, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },
  { phase: "typing", titleChars: 15, diffLines: 0, merged: false, loopOffset: 1, killArmed: false, delayMs: 240,
    c0Chars: C0_LEN, c1Chars: 0, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },

  // 7-8 title freezes mid-word; C1 speaks up (drafting announcement)
  { phase: "typing", titleChars: CRASH_CHAR_COUNT, diffLines: 0, merged: false, loopOffset: 1, killArmed: false, delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 34, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },
  { phase: "typing", titleChars: CRASH_CHAR_COUNT, diffLines: 0, merged: false, loopOffset: 1, killArmed: false, delayMs: 500,
    c0Chars: C0_LEN, c1Chars: 70, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },

  // 9 armed: C1 delivered, kill pulses, 12s to decide
  { phase: "typing", titleChars: CRASH_CHAR_COUNT, diffLines: 0, merged: false, loopOffset: 1, killArmed: true, delayMs: 12000,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },

  // 10 crashed: title frozen mid-word, first two callouts already delivered
  { phase: "crashed", titleChars: CRASH_CHAR_COUNT, diffLines: 0, merged: false, loopOffset: 1, killArmed: false, delayMs: 2400,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: false, c1Cached: false, c2Cached: false },

  // 11 replaying: title snaps to full (cached), thread gets cached sigils
  { phase: "replaying", titleChars: PR_TITLE.length, diffLines: 0, merged: false, loopOffset: 1, killArmed: false, delayMs: 1000,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: true, c1Cached: true, c2Cached: false },

  // 12-13 diff lines stream in
  { phase: "replaying", titleChars: PR_TITLE.length, diffLines: 3, merged: false, loopOffset: 1, killArmed: false, delayMs: 500,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: true, c1Cached: true, c2Cached: false },
  { phase: "replaying", titleChars: PR_TITLE.length, diffLines: DIFF_LINES.length, merged: false, loopOffset: 1, killArmed: false, delayMs: 500,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: 0, c0Cached: true, c1Cached: true, c2Cached: false },

  // 14 resumed + C2 speaks up (merge verdict)
  { phase: "resumed", titleChars: PR_TITLE.length, diffLines: DIFF_LINES.length, merged: true, loopOffset: 1, killArmed: false, delayMs: 0,
    c0Chars: C0_LEN, c1Chars: C1_LEN, c2Chars: C2_LEN, c0Cached: true, c1Cached: true, c2Cached: false },
];

const CRASH_FRAME = 10;

// --- component ----------------------------------------------------------

export function PatcherDemo({ variant }: { variant: SentinelVariant }) {
  const [fi, setFi] = useState(0);
  const frame = FRAMES[fi];

  useEffect(() => {
    if (frame.delayMs <= 0) return;
    const id = setTimeout(
      () => setFi((i) => Math.min(i + 1, FRAMES.length - 1)),
      frame.delayMs,
    );
    return () => clearTimeout(id);
  }, [fi, frame.delayMs]);

  const handleStart = useCallback(() => {
    setFi((i) => (i === 0 ? 1 : i));
  }, []);
  const handleReset = useCallback(() => setFi(0), []);
  const handleKill = useCallback(() => {
    if (frame.killArmed) setFi(CRASH_FRAME);
  }, [frame.killArmed]);

  useSlideRunReset({ onStart: handleStart, onReset: handleReset });
  const runId = useObserverRunId(fi > 0);

  const isCrashed = frame.phase === "crashed";
  const isReplaying = frame.phase === "replaying";
  const isResumed = frame.phase === "resumed";
  const showArrows = fi >= 2 && !isCrashed;
  const loopNumber = variant.startingLoop + Math.max(0, frame.loopOffset - 1);

  const prsCount = 4_214 + (isResumed ? 1 : 0);

  const c0State = calloutState(frame.c0Chars, frame.c0Cached, C0_LEN);
  const c1State = calloutState(frame.c1Chars, frame.c1Cached, C1_LEN);
  const c2State = calloutState(frame.c2Chars, frame.c2Cached, C2_LEN);
  const c0Visible = frame.c0Chars > 0 || frame.c0Cached;
  const c1Visible = frame.c1Chars > 0 || frame.c1Cached;
  const c2Visible = frame.c2Chars > 0 || frame.c2Cached;

  const debugEvents: DebugEvent[] = useMemo(() => {
    const out: DebugEvent[] = [];
    if (fi === 0) return out;
    const seen = { scanned: false, matched: false, typed: false, crashed: false, replayed: false, merged: false };
    for (let i = 1; i <= fi; i++) {
      const fr = FRAMES[i];
      if (!fr) break;
      if (!seen.scanned && fr.phase === "scanning") {
        out.push({ kind: "RUN", msg: "scanDeployments() · 6 services" });
        seen.scanned = true;
      }
      if (!seen.matched && fr.phase === "matched") {
        out.push({ kind: "OK ", msg: "cveMatch(@openai ≥4.20.1) · 3 hits" });
        seen.matched = true;
      }
      if (!seen.typed && fr.phase === "typing") {
        out.push({ kind: "RUN", msg: "openPullRequest(@openai → 4.20.1)" });
        seen.typed = true;
      }
      if (!seen.crashed && fr.phase === "crashed") {
        out.push({ kind: "ERR", msg: "runner down · branch already pushed" });
        seen.crashed = true;
      }
      if (!seen.replayed && fr.phase === "replaying") {
        out.push({ kind: "RPL", msg: "replaying · branch exists, no-op" });
        seen.replayed = true;
      }
      if (!seen.merged && fr.phase === "resumed") {
        out.push({ kind: "OK ", msg: "mergePullRequest(#9182) · idempotent" });
        out.push({ kind: "END", msg: "resumed · 0 rollbacks" });
        seen.merged = true;
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
              Supply-chain patcher · CVE triage
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Counter label="CVEs patched" value="918" />
            <Counter label="PRs landed" value={prsCount.toLocaleString()} accent="emerald" />
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

      {/* 3-column board */}
      <div className="relative grid min-h-0 flex-1 grid-cols-[1fr_1fr_1.5fr] gap-4 overflow-hidden">
        <ArrowsOverlay visible={showArrows} matched={MATCHED_SERVICE_IDXS} />

        {/* col 1: deployments */}
        <BoardColumn label="Running deployments" sub="services · live">
          {SERVICES.map((s, i) => {
            const matched = MATCHED_SERVICE_IDXS.includes(i) && fi >= 2;
            return (
              <div
                key={s.name}
                data-service-idx={i}
                className={`flex flex-col gap-1 rounded-lg border px-3 py-2 transition-all duration-500 ${
                  matched
                    ? "border-red-500/50 bg-red-500/[0.08] shadow-[0_0_20px_rgba(248,113,113,0.2)]"
                    : "border-white/10 bg-black/40"
                }`}
              >
                <span className="font-mono text-sm text-white">{s.name}</span>
                <span
                  className={`font-mono text-xs ${
                    matched ? "text-red-300" : "text-zinc-500"
                  }`}
                >
                  {s.pkg} {s.version}
                </span>
              </div>
            );
          })}
        </BoardColumn>

        {/* col 2: CVE matches */}
        <BoardColumn label="CVE matches" sub="nvd feed · 2 open">
          {CVES.map((c, i) => {
            const active = i === 0 && fi >= 2;
            return (
              <div
                key={c.id}
                data-cve-idx={i}
                className={`flex flex-col gap-2 rounded-lg border px-3 py-3 transition-all duration-500 ${
                  active
                    ? "border-red-500/60 bg-red-500/[0.08] shadow-[0_0_24px_rgba(248,113,113,0.25)]"
                    : "border-white/10 bg-black/40 opacity-40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-white">
                    {c.id}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                      c.severity === "high"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {c.severity}
                  </span>
                </div>
                <span className="font-mono text-xs text-zinc-400">
                  {c.pkg} ≥ {c.fixVersion}
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {c.pkg === "@openai" ? "3 services affected" : "1 service affected"}
                </span>
              </div>
            );
          })}
        </BoardColumn>

        {/* col 3: PR drafts + agent thread */}
        <div className="relative flex min-h-0 flex-col gap-2 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              Patcher thread
            </span>
            <span className="font-mono text-[11px] text-zinc-500">
              branch · cve/openai-4.20.1
            </span>
          </div>

          {/* agent thread: 3 callouts stack above the PR card */}
          <div className="flex flex-col gap-2">
            <CalloutSlot callout={CALLOUT_C0} state={c0State} visible={c0Visible} />
            <CalloutSlot callout={CALLOUT_C1} state={c1State} visible={c1Visible} />
            <CalloutSlot callout={CALLOUT_C2} state={c2State} visible={c2Visible} />
          </div>

          {/* PR card */}
          <div
            className={`flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-white/10 bg-black/40 p-3 transition-opacity duration-500 ${
              fi >= 5 ? "opacity-100" : "opacity-30"
            }`}
          >
            {/* title row */}
            <div className="flex items-start gap-3">
              <span
                className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isResumed
                    ? "bg-emerald-500 text-black"
                    : isCrashed
                      ? "bg-red-500/80 text-white"
                      : "bg-sky-500 text-white"
                }`}
              >
                {isResumed ? "✓" : isCrashed ? "!" : "◆"}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-mono text-xs text-zinc-500">
                  anthropic-bot wants to merge 1 commit into <span className="text-white">main</span>
                </span>
                <span className="mt-1 font-mono text-sm text-white">
                  {PR_TITLE.slice(0, frame.titleChars)}
                  {isCrashed && <span className="ml-0.5 text-red-400">▍</span>}
                  {!isCrashed && !isResumed && frame.titleChars > 0 && frame.titleChars < PR_TITLE.length && (
                    <span className="ml-0.5 animate-pulse text-sky-400">▍</span>
                  )}
                  {isReplaying && frame.titleChars === PR_TITLE.length && (
                    <span className="ml-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-300">
                      cached
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* diff */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-white/10 bg-black/60 font-mono text-xs">
              {DIFF_LINES.map((line, i) => {
                const visible = i < frame.diffLines;
                const color =
                  line.kind === "+" ? "text-emerald-300 bg-emerald-500/[0.08]"
                  : line.kind === "-" ? "text-red-300 bg-red-500/[0.08]"
                  : "text-zinc-500 bg-black/40";
                return (
                  <div
                    key={i}
                    className={`border-b border-white/5 px-3 py-1 transition-opacity duration-300 ${color} ${
                      visible ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {line.text}
                  </div>
                );
              })}
            </div>

            {/* status row */}
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors duration-300 ${
                  isResumed
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40"
                    : isCrashed
                      ? "bg-red-500/15 text-red-300 border border-red-500/40"
                      : "bg-sky-500/10 text-sky-300 border border-sky-500/30"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isResumed
                      ? "bg-emerald-400"
                      : isCrashed
                        ? "bg-red-400"
                        : "bg-sky-400 animate-pulse"
                  }`}
                />
                {isResumed ? "auto-merged" : isCrashed ? "runner down" : isReplaying ? "replaying" : "drafting"}
              </span>
              <span className="font-mono text-[11px] text-zinc-500">
                #9182 · +3 −3
              </span>
            </div>
          </div>

          {/* col-3-local crashed overlay */}
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-red-500/15 backdrop-blur-[1px] transition-opacity duration-300 ${
              isCrashed ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="rounded-2xl border-2 border-red-500/60 bg-black/85 px-8 py-5 text-center shadow-[0_0_80px_rgba(248,113,113,0.5)]">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-red-400">
                runner down
              </p>
              <p className="mt-1 text-2xl font-semibold text-red-200">
                Branch already pushed
              </p>
              <p className="mt-2 font-mono text-[11px] text-zinc-400">
                cve/openai-4.20.1 · commit <span className="text-red-300">a3f9e21</span>
              </p>
            </div>
          </div>
        </div>

        {/* idle hint */}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-black/70 transition-opacity duration-500 ${
            fi === 0 ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-sky-300">
              {variant.eyebrow}
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {variant.purposeLine}
            </p>
            <p className="mt-4 text-base text-zinc-400">
              Press <kbd className="mx-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-base">r</kbd> to watch the runner.
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
            PR landed. No duplicate.
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
          ✗ {variant.kill.buttonLabel}
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
      className={`transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <AgentCallout callout={callout} state={state} />
    </div>
  );
}

// --- column wrapper -----------------------------------------------------

function BoardColumn({
  label,
  sub,
  children,
}: {
  label: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          {label}
        </span>
        <span className="font-mono text-[11px] text-zinc-500">{sub}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// --- arrows overlay -----------------------------------------------------

function ArrowsOverlay({ visible, matched }: { visible: boolean; matched: number[] }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {matched.map((idx) => {
        const y1 = 18 + idx * 13.2;
        const y2 = 24;
        return (
          <path
            key={idx}
            d={`M 32 ${y1} C 36 ${y1}, 38 ${y2}, 41 ${y2}`}
            stroke="rgb(248 113 113 / 0.55)"
            strokeWidth="0.35"
            strokeDasharray="1.2 1"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
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
  accent?: "white" | "emerald";
}) {
  const color = accent === "emerald" ? "text-emerald-200" : "text-white";
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </span>
      <span className={`font-mono text-3xl tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
