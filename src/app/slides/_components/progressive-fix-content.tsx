"use client";

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TabTone } from "./code-editor-tabs";
import type { FixStep } from "./fix-slide-layout";

export type ProgressiveExtraTab = {
  filename: string;
  /** One entry per progression state; length 1 = static across states. */
  htmls: string[];
  tone?: TabTone;
};

type StatusTone = "fuchsia" | "red" | "amber" | "sky" | "emerald";

const DOT_COLOR: Record<StatusTone, string> = {
  fuchsia: "bg-fuchsia-400",
  red: "bg-red-400",
  amber: "bg-amber-400",
  sky: "bg-sky-400",
  emerald: "bg-emerald-400",
};

const DOT_GLOW: Record<StatusTone, string> = {
  fuchsia: "0 0 10px rgba(232,121,249,0.6)",
  red: "0 0 10px rgba(248,113,113,0.6)",
  amber: "0 0 10px rgba(252,211,77,0.6)",
  sky: "0 0 10px rgba(56,189,248,0.6)",
  emerald: "0 0 10px rgba(52,211,153,0.6)",
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

type Props = {
  headline: string;
  filename: string;
  textClass?: string;
  steps: FixStep[];
  codeHtmls: string[];
  extraTabs?: ProgressiveExtraTab[];
  pillLabel?: ReactNode;
  statusTone: StatusTone;
};

export function ProgressiveFixContent({
  headline,
  filename,
  textClass = "text-[26px]",
  steps,
  codeHtmls,
  extraTabs,
  pillLabel,
  statusTone,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const overlayRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevOverlayKeyRef = useRef<string>("0-0");

  useLayoutEffect(() => {
    const nextKey = `${activeTab}-${activeIndex}`;
    const prevKey = prevOverlayKeyRef.current;
    if (nextKey !== prevKey) {
      const prev = overlayRefs.current.get(prevKey);
      const next = overlayRefs.current.get(nextKey);
      if (prev && next) {
        next.scrollTop = prev.scrollTop;
        next.scrollLeft = prev.scrollLeft;
      }
      prevOverlayKeyRef.current = nextKey;
    }
  }, [activeIndex, activeTab]);
  const total = codeHtmls.length;
  const hasTabs = !!extraTabs && extraTabs.length > 0;
  const tabCount = 1 + (extraTabs?.length ?? 0);
  const tabLength = (tab: number): number =>
    tab === 0 ? total : extraTabs![tab - 1].htmls.length;
  const currentTabLength = tabLength(activeTab);
  const appliedCount = activeTab === 0 ? activeIndex : total;

  useEffect(() => {
    const markVisited = (tab: number) =>
      setVisited((prev) => {
        if (prev.has(tab)) return prev;
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
    const onForward = (e: Event) => {
      if (activeIndex < currentTabLength - 1) {
        e.preventDefault();
        setActiveIndex(activeIndex + 1);
        return;
      }
      if (activeTab < tabCount - 1) {
        e.preventDefault();
        const nextTab = activeTab + 1;
        setActiveTab(nextTab);
        setActiveIndex(0);
        markVisited(nextTab);
      }
    };
    const onBack = (e: Event) => {
      if (activeIndex > 0) {
        e.preventDefault();
        setActiveIndex(activeIndex - 1);
        return;
      }
      if (activeTab > 0) {
        e.preventDefault();
        const prevTab = activeTab - 1;
        setActiveTab(prevTab);
        setActiveIndex(tabLength(prevTab) - 1);
      }
    };
    window.addEventListener("slide:nav-forward", onForward);
    window.addEventListener("slide:nav-back", onBack);
    return () => {
      window.removeEventListener("slide:nav-forward", onForward);
      window.removeEventListener("slide:nav-back", onBack);
    };
    // tabLength is derived from props + activeTab, so the listed deps cover it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, activeTab, currentTabLength, tabCount, total, extraTabs]);

  return (
    <>
      <div className="flex flex-col">
        <h2
          className="mt-6 text-[44px] font-semibold text-white"
          style={{ lineHeight: "46px", letterSpacing: "-2.2px" }}
        >
          {headline}
        </h2>

        <ol className="mt-8 flex flex-col gap-4">
          {steps.map((step, i) => {
            const applied = i < appliedCount;
            return (
              <li
                key={i}
                className="flex gap-4 transition-opacity duration-200"
                style={{ opacity: applied ? 1 : 0.35 }}
              >
                <span
                  className={`pt-1 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors duration-200 ${
                    applied ? "text-zinc-400" : "text-zinc-700"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-1">
                  <span
                    className={`text-[15px] font-medium transition-colors duration-200 ${
                      applied ? "text-zinc-100" : "text-zinc-500"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span
                    className={`font-mono text-[12px] transition-colors duration-200 ${
                      applied ? "text-zinc-500" : "text-zinc-700"
                    }`}
                  >
                    {step.detail}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {pillLabel ? (
          <div className="mt-auto flex items-center gap-2 border-t border-white/10 pt-6">
            <span
              className={`inline-block h-[7px] w-[7px] rounded-full ${DOT_COLOR[statusTone]}`}
              style={{ boxShadow: DOT_GLOW[statusTone] }}
            />
            <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-zinc-400">
              {pillLabel}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0a0a0a]">
        {hasTabs ? (
          <div className="flex items-stretch border-b border-white/10">
            {[{ filename, tone: undefined as TabTone | undefined }, ...extraTabs!.map((t) => ({ filename: t.filename, tone: t.tone }))].map((tab, i) => {
              const isActive = i === activeTab;
              const showTone = !!tab.tone && !visited.has(i);
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
                    setActiveTab(i);
                    setActiveIndex(0);
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
        ) : (
          <div className="flex items-center border-b border-white/10 px-6 py-3">
            <span className="font-mono text-[12px] text-zinc-500">{filename}</span>
          </div>
        )}
        <div className="code-scroll-area relative min-h-0 flex-1 overflow-hidden">
          {/* height ghost: stack every tab's final state so the container grows to the tallest */}
          <div
            aria-hidden="true"
            className="invisible grid grid-cols-1 grid-rows-1 px-8 py-6"
          >
            <pre
              className={`col-start-1 row-start-1 m-0 whitespace-pre font-mono ${textClass} leading-[1.5]`}
              // biome-ignore lint: Shiki emits trusted, pre-escaped HTML
              dangerouslySetInnerHTML={{ __html: codeHtmls[total - 1] }}
            />
            {extraTabs?.map((tab) => (
              <pre
                key={`ghost-${tab.filename}`}
                className={`col-start-1 row-start-1 m-0 whitespace-pre font-mono ${textClass} leading-[1.5]`}
                // biome-ignore lint: Shiki emits trusted, pre-escaped HTML
                dangerouslySetInnerHTML={{ __html: tab.htmls[tab.htmls.length - 1] }}
              />
            ))}
          </div>
          {/* progression overlays: visible only when the primary tab is active */}
          {codeHtmls.map((html, i) => {
            const isActive = activeTab === 0 && i === activeIndex;
            const key = `0-${i}`;
            return (
              <div
                key={`prog-${i}`}
                aria-hidden={!isActive}
                ref={(el) => {
                  if (el) overlayRefs.current.set(key, el);
                  else overlayRefs.current.delete(key);
                }}
                className={`absolute inset-0 overflow-auto px-8 py-6 transition-opacity duration-200 ${
                  isActive ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <pre
                  className={`m-0 whitespace-pre font-mono ${textClass} leading-[1.5]`}
                  // biome-ignore lint: Shiki emits trusted, pre-escaped HTML
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            );
          })}
          {/* supplementary tab overlays: each tab gets its own per-state overlays */}
          {extraTabs?.map((tab, tabIdx) => {
            const tabIsActive = activeTab === tabIdx + 1;
            return tab.htmls.map((html, i) => {
              const isActive = tabIsActive && i === activeIndex;
              const key = `${tabIdx + 1}-${i}`;
              return (
                <div
                  key={`extra-${tab.filename}-${i}`}
                  aria-hidden={!isActive}
                  ref={(el) => {
                    if (el) overlayRefs.current.set(key, el);
                    else overlayRefs.current.delete(key);
                  }}
                  className={`absolute inset-0 overflow-auto px-8 py-6 transition-opacity duration-200 ${
                    isActive ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  <pre
                    className={`m-0 whitespace-pre font-mono ${textClass} leading-[1.5]`}
                    // biome-ignore lint: Shiki emits trusted, pre-escaped HTML
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </div>
              );
            });
          })}
        </div>
      </div>
    </>
  );
}
