"use client";

import { useState } from "react";

export type CodeEditorTab = {
  filename: string;
  /** Pre-rendered Shiki HTML (inline token spans). */
  html: string;
  /** Small right-aligned directive label, e.g. "use workflow". */
  directive?: string;
  /** Tone applied to the directive label. */
  directiveTone?: "emerald" | "fuchsia" | "zinc";
};

type Props = {
  tabs: CodeEditorTab[];
  textClass?: string;
};

const DIRECTIVE_COLOR = {
  emerald: "text-emerald-400/80",
  fuchsia: "text-fuchsia-400/80",
  zinc: "text-zinc-400/80",
} as const;

export function CodeEditorTabs({ tabs, textClass = "text-[26px]" }: Props) {
  const [active, setActive] = useState(0);
  const current = tabs[active];

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0a0a0a]">
      <div className="flex items-stretch justify-between border-b border-white/10">
        <div className="flex">
          {tabs.map((tab, i) => {
            const isActive = i === active;
            return (
              <button
                type="button"
                key={tab.filename}
                onClick={() => setActive(i)}
                className={`border-r border-white/10 px-6 py-3 font-mono text-[12px] transition-colors ${
                  isActive
                    ? "bg-white/[0.04] text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab.filename}
              </button>
            );
          })}
        </div>
        {current.directive ? (
          <span
            className={`px-6 py-3 font-mono text-[11px] uppercase tracking-[0.22em] ${DIRECTIVE_COLOR[current.directiveTone ?? "emerald"]}`}
          >
            {current.directive}
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <pre
          className={`m-0 whitespace-pre font-mono ${textClass} leading-[1.5]`}
          // biome-ignore lint: Shiki emits trusted, pre-escaped HTML
          dangerouslySetInnerHTML={{ __html: current.html }}
        />
      </div>
    </div>
  );
}
