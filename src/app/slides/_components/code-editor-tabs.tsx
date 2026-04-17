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
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0a0a0a]">
      <div className="flex items-stretch justify-between border-b border-white/10">
        <div className="flex">
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
                className={`flex items-center gap-2 border-r border-white/10 px-6 py-3 font-mono text-[12px] transition-colors ${
                  isActive ? "bg-white/[0.04]" : ""
                } ${toneText}`}
              >
                <span
                  className={`inline-block h-[6px] w-[6px] rounded-full transition-opacity duration-300 ${
                    showTone ? TONE_DOT[tab.tone!] : "bg-transparent"
                  }`}
                  style={{
                    boxShadow: showTone ? TONE_GLOW[tab.tone!] : undefined,
                    opacity: showTone ? 1 : 0,
                  }}
                />
                {tab.filename}
              </button>
            );
          })}
        </div>
      </div>
      <div className="code-scroll-area min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <pre
          className={`m-0 whitespace-pre font-mono ${textClass} leading-[1.5]`}
          // biome-ignore lint: Shiki emits trusted, pre-escaped HTML
          dangerouslySetInnerHTML={{ __html: current.html }}
        />
      </div>
    </div>
  );
}
