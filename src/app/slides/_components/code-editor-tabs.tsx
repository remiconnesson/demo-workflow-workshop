"use client";

import { useState } from "react";

export type TabTone = "fuchsia" | "red" | "amber" | "sky" | "emerald";

export type CodeEditorTab = {
  filename: string;
  /** Pre-rendered Shiki HTML (inline token spans). */
  html: string;
  /** Optional semantic tone — adds a colored dot and active underline. */
  tone?: TabTone;
};

type Props = {
  tabs: CodeEditorTab[];
  textClass?: string;
};

const TONE_DOT: Record<TabTone, string> = {
  fuchsia: "bg-fuchsia-400",
  red: "bg-red-400",
  amber: "bg-amber-400",
  sky: "bg-sky-400",
  emerald: "bg-emerald-400",
};

const TONE_GLOW: Record<TabTone, string> = {
  fuchsia: "0 0 8px rgba(232,121,249,0.7)",
  red: "0 0 8px rgba(248,113,113,0.7)",
  amber: "0 0 8px rgba(252,211,77,0.7)",
  sky: "0 0 8px rgba(56,189,248,0.7)",
  emerald: "0 0 8px rgba(52,211,153,0.7)",
};

const TONE_ACTIVE_TEXT: Record<TabTone, string> = {
  fuchsia: "text-fuchsia-300",
  red: "text-red-300",
  amber: "text-amber-300",
  sky: "text-sky-300",
  emerald: "text-emerald-300",
};

const TONE_INACTIVE_TEXT: Record<TabTone, string> = {
  fuchsia: "text-fuchsia-400/70 hover:text-fuchsia-300",
  red: "text-red-400/70 hover:text-red-300",
  amber: "text-amber-400/70 hover:text-amber-300",
  sky: "text-sky-400/70 hover:text-sky-300",
  emerald: "text-emerald-400/70 hover:text-emerald-300",
};

export function CodeEditorTabs({ tabs, textClass = "text-[26px]" }: Props) {
  const [active, setActive] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const current = tabs[active];

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a]">
      <div className="flex min-h-[58px] items-stretch justify-between border-b border-white/10">
        <div className="flex min-w-0 overflow-hidden">
          {tabs.map((tab, i) => {
            const isActive = i === active;
            const showTone = tab.tone && !visited.has(i);
            const toneText = showTone
              ? isActive
                ? TONE_ACTIVE_TEXT[tab.tone!]
                : TONE_INACTIVE_TEXT[tab.tone!]
              : isActive
                ? "text-white"
                : "text-zinc-500 hover:text-zinc-300";
            return (
              <button
                type="button"
                key={tab.filename}
                onClick={() => {
                  setActive(i);
                  setVisited((prev) => {
                    if (prev.has(i)) return prev;
                    const next = new Set(prev);
                    next.add(i);
                    return next;
                  });
                }}
                className={`relative flex min-h-[58px] max-w-[280px] items-center gap-3 border-r border-white/10 px-6 py-4 font-mono text-base leading-none transition-colors ${
                  isActive ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
                } ${toneText}`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-opacity duration-300 ${
                    showTone ? TONE_DOT[tab.tone!] : "bg-transparent"
                  }`}
                  style={{
                    boxShadow: showTone ? TONE_GLOW[tab.tone!] : undefined,
                    opacity: showTone ? 1 : 0,
                  }}
                />
                <span className="truncate">{tab.filename}</span>
                <span
                  className={`pointer-events-none absolute inset-x-0 bottom-0 h-[3px] transition-colors duration-200 ${
                    isActive
                      ? tab.tone
                        ? TONE_DOT[tab.tone]
                        : "bg-white"
                      : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-white/10 px-5 py-4 font-mono text-base leading-none text-zinc-500">
          <span className="text-zinc-700">file</span>
          <span className="tabular-nums text-zinc-300">
            {active + 1}/{tabs.length}
          </span>
        </div>
      </div>
      <div className="code-scroll-area min-h-0 flex-1 overflow-auto px-8 py-6">
        <pre
          className={`m-0 whitespace-pre font-mono ${textClass} leading-[1.5]`}
          // biome-ignore lint: Shiki emits trusted, pre-escaped HTML
          dangerouslySetInnerHTML={{ __html: current.html }}
        />
      </div>
    </div>
  );
}
