"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AgentEvent =
  | { kind: "user"; at: number; text: string }
  | { kind: "thinking"; at: number; text: string }
  | { kind: "tool_call"; at: number; name: string; args: string }
  | { kind: "tool_result"; at: number; name: string; summary: string }
  | { kind: "final"; at: number; text: string }
  | { kind: "handoff"; at: number; text: string };

const SCRIPT: AgentEvent[] = [
  {
    kind: "user",
    at: 0,
    text: "something spicy, under $15, gluten-free",
  },
  { kind: "thinking", at: 600, text: "Parsing constraints · budget $15 · gluten-free · spicy" },
  {
    kind: "tool_call",
    at: 1400,
    name: "searchRestaurants",
    args: '{ "cuisine": ["thai","korean","szechuan"], "maxPrice": 15, "dietary": "gluten-free" }',
  },
  {
    kind: "tool_result",
    at: 2400,
    name: "searchRestaurants",
    summary: "4 candidates · top match: Siam Street · $12 avg · 4.8★",
  },
  {
    kind: "thinking",
    at: 3100,
    text: "Top match looks good. Verifying gluten-free options on the menu.",
  },
  {
    kind: "tool_call",
    at: 3900,
    name: "checkMenuItems",
    args: '{ "restaurant": "siam_street", "filter": "gluten-free" }',
  },
  {
    kind: "tool_result",
    at: 4900,
    name: "checkMenuItems",
    summary: "6 gluten-free items · spicy basil chicken · pad thai · tom yum",
  },
  {
    kind: "thinking",
    at: 5500,
    text: "Spicy basil chicken fits all constraints. Done.",
  },
  {
    kind: "final",
    at: 6100,
    text: "Picked: Siam Street · Spicy Basil Chicken · $13.50",
  },
  {
    kind: "handoff",
    at: 6800,
    text: "Handing off to placeOrder pipeline — crash-safe from here.",
  },
];

const TOTAL_DURATION = SCRIPT[SCRIPT.length - 1]!.at + 1200;

export function DurableAgentMock() {
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startedAtRef.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (playing) return;
    setPlayhead(0);
    setPipelineRunning(false);
    setPlaying(true);
    startedAtRef.current = null;

    const tick = (ts: number) => {
      if (startedAtRef.current === null) startedAtRef.current = ts;
      const elapsed = ts - startedAtRef.current;
      if (elapsed >= TOTAL_DURATION) {
        setPlayhead(TOTAL_DURATION);
        setPlaying(false);
        setPipelineRunning(true);
        rafRef.current = null;
        return;
      }
      setPlayhead(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [playing]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const visibleEvents = SCRIPT.filter((e) => e.at <= playhead);

  return (
    <div className="grid h-full grid-cols-[360px_1fr] gap-6">
      {/* Customer phone */}
      <div className="flex flex-col rounded-[44px] border-[12px] border-black bg-white p-5 shadow-[0_0_0_2px_rgba(255,255,255,0.04)]">
        <div className="mx-auto h-5 w-32 rounded-full bg-black" />
        <div className="mt-5 flex flex-1 flex-col gap-3 overflow-hidden font-sans">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Triangle Donuts · delivery
          </div>

          {/* Customer bubble */}
          <div className="rounded-2xl rounded-br-md bg-sky-500 px-4 py-2 text-[14px] leading-snug text-white self-end max-w-[85%]">
            {SCRIPT[0]!.kind === "user" ? SCRIPT[0]!.text : ""}
          </div>

          {/* Agent thinking bubble */}
          {visibleEvents.some((e) => e.kind === "final") ? (
            <div className="rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-3 text-[14px] leading-snug text-zinc-900 self-start max-w-[90%]">
              <div className="font-semibold">Siam Street</div>
              <div className="mt-1 text-[12px] text-zinc-600">
                Spicy Basil Chicken · $13.50
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Gluten-free · ~22 min
              </div>
            </div>
          ) : visibleEvents.some((e) => e.kind === "thinking" || e.kind === "tool_call") ? (
            <div className="flex items-center gap-2 self-start rounded-2xl bg-zinc-100 px-4 py-2 text-[13px] text-zinc-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-500" />
              <span>Picking a restaurant…</span>
            </div>
          ) : null}

          {pipelineRunning ? (
            <div className="mt-auto rounded-xl border border-emerald-400/40 bg-emerald-50 p-3 text-[12px] text-emerald-700">
              <div className="font-semibold">Order placed</div>
              <div className="mt-1">Charging card · notifying kitchen…</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Agent reasoning timeline */}
      <div className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-zinc-950 p-6">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-300/80">
            Agent · DurableAgent.run
          </div>
          <button
            onClick={() => (playing ? stop() : play())}
            className="rounded-lg border border-sky-400/40 bg-sky-500/10 px-4 py-1.5 font-mono text-sm text-sky-200 hover:border-sky-300 hover:text-sky-100 transition-colors"
          >
            {playing ? "Stop" : playhead >= TOTAL_DURATION ? "Replay" : "Run"}
          </button>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto font-mono text-[13px]">
          {visibleEvents.map((event, i) => (
            <AgentEventRow key={i} event={event} />
          ))}
          {playing && visibleEvents.length > 0 ? (
            <div className="flex items-center gap-2 text-zinc-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
              <span>…</span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/5 bg-black/40 px-4 py-2 text-[11px] font-mono text-zinc-500">
          <span>mode:</span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300">recorded</span>
          <span className="text-zinc-700">·</span>
          <span>
            live requires <span className="text-zinc-400">NEXT_PUBLIC_AGENT_LIVE=1</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function AgentEventRow({ event }: { event: AgentEvent }) {
  switch (event.kind) {
    case "user":
      return (
        <div className="flex gap-3">
          <span className="w-20 shrink-0 text-zinc-600">user</span>
          <span className="text-zinc-200">&quot;{event.text}&quot;</span>
        </div>
      );
    case "thinking":
      return (
        <div className="flex gap-3">
          <span className="w-20 shrink-0 text-zinc-600">thinking</span>
          <span className="italic text-zinc-400">{event.text}</span>
        </div>
      );
    case "tool_call":
      return (
        <div className="flex gap-3">
          <span className="w-20 shrink-0 text-amber-300">tool →</span>
          <div>
            <div className="text-amber-200">{event.name}()</div>
            <div className="text-[11px] text-zinc-500">{event.args}</div>
          </div>
        </div>
      );
    case "tool_result":
      return (
        <div className="flex gap-3">
          <span className="w-20 shrink-0 text-emerald-400">← result</span>
          <span className="text-emerald-200/90">{event.summary}</span>
        </div>
      );
    case "final":
      return (
        <div className="flex gap-3">
          <span className="w-20 shrink-0 text-sky-300">picked</span>
          <span className="font-semibold text-sky-100">{event.text}</span>
        </div>
      );
    case "handoff":
      return (
        <div className="flex gap-3 rounded border border-white/5 bg-white/5 px-3 py-2">
          <span className="w-20 shrink-0 text-zinc-500">handoff</span>
          <span className="text-zinc-200">{event.text}</span>
        </div>
      );
  }
}
