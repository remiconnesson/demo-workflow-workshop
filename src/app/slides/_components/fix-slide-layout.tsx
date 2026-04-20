import type { ReactNode } from "react";
import { codeToHtml } from "shiki";
import type { OrderStepId } from "@/lib/order-contract";
import { isAgentGroupSlug, type AgentGroupSlug, type SlideGroupSlug } from "../_data/agent-groups";
import { AgentBeatStrip } from "./agent-beat-strip";
import { CodeBlock } from "./code-block";
import { CodeEditorTabs, type CodeEditorTab, type TabTone } from "./code-editor-tabs";
import { FinishedTimelineStrip } from "./finished-timeline-strip";
import { ProgressiveFixContent } from "./progressive-fix-content";

export type ProgressionState = {
  code: string;
  /** Map of 1-based line number → tooltip text. Empty string = highlight only. */
  highlightLines?: Record<number, string>;
};

export type WorkflowFixTab =
  | {
      filename: string;
      code: string;
      lang?: "ts" | "tsx" | "js" | "jsx";
      /** Map of 1-based line number → tooltip text. Empty string = highlight only. */
      highlightLines?: Record<number, string>;
      /** Optional semantic tone that adds a colored dot in the tab strip. */
      tone?: TabTone;
      progression?: never;
    }
  | {
      filename: string;
      /** Progressive states that scrub alongside the primary tab. */
      progression: ProgressionState[];
      lang?: "ts" | "tsx" | "js" | "jsx";
      tone?: TabTone;
      code?: never;
      highlightLines?: never;
    };

/**
 * Single-code mode: the full snippet is rendered at once, with optional
 * per-line hover tooltips and optional secondary tabs.
 *
 * Progressive mode: the presenter scrubs through an ordered series of code
 * states (via ArrowRight/ArrowLeft) that build the snippet up one primitive
 * at a time. `progression.length` should equal `steps.length + 1`: state 0
 * is the baseline with no concepts yet, and each subsequent state corresponds
 * to the concept described by the matching step.
 */
export type WorkflowFix =
  | {
      code: string;
      highlightLines?: Record<number, string>;
      tabs?: WorkflowFixTab[];
      progression?: never;
    }
  | {
      progression: ProgressionState[];
      /** Static supplementary tabs rendered beside the scrubbing primary file. */
      tabs?: WorkflowFixTab[];
      code?: never;
      highlightLines?: never;
    };

export type FixStep = { label: ReactNode; detail: ReactNode };

type StatusTone = "fuchsia" | "red" | "amber" | "sky" | "emerald";

type FixSlideLayoutProps = {
  slide: SlideGroupSlug;
  eyebrow: string;
  headline: string;
  marker: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
  highlightSteps?: OrderStepId[];
  workflowFix: WorkflowFix;
  steps: FixStep[];
  filename?: string;
  statusLabel?: string;
  statusTone?: StatusTone;
};

function formatTip(text: string): string {
  let result = text.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
  );
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="code-hl-keyword">$1</strong>');
  return result;
}

function wrapLines(html: string, highlightLines?: Record<number, string>): string {
  if (!highlightLines || Object.keys(highlightLines).length === 0) return html;
  const lines = html.split("<br>");
  return lines
    .map((line, i) => {
      const tooltip = highlightLines[i + 1];
      if (tooltip === undefined) return `<div>${line}</div>`;
      const tip = tooltip
        ? `<div class="code-hl-tip">${formatTip(tooltip)}</div>`
        : "";
      return `<div class="code-hl">${line}${tip}</div>`;
    })
    .join("");
}

async function highlight(code: string, lang: "ts" | "tsx" | "js" | "jsx" = "ts", highlightLines?: Record<number, string>) {
  const html = await codeToHtml(code, {
    lang,
    theme: "github-dark-default",
    structure: "inline",
  });
  return wrapLines(html, highlightLines);
}

type SingleCodeFix = Extract<WorkflowFix, { code: string }>;

async function buildTabs(
  primaryFilename: string,
  workflowFix: SingleCodeFix,
): Promise<CodeEditorTab[]> {
  const primary: CodeEditorTab = {
    filename: primaryFilename,
    html: await highlight(workflowFix.code, "ts", workflowFix.highlightLines),
  };
  const extras = await Promise.all(
    (workflowFix.tabs ?? []).map(async (tab) => {
      if ("progression" in tab && tab.progression) {
        const last = tab.progression[tab.progression.length - 1];
        return {
          filename: tab.filename,
          html: await highlight(last.code, tab.lang ?? "ts", last.highlightLines),
          tone: tab.tone,
        };
      }
      return {
        filename: tab.filename,
        html: await highlight(tab.code, tab.lang ?? "ts", tab.highlightLines),
        tone: tab.tone,
      };
    }),
  );
  return [primary, ...extras];
}

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

/**
 * Workflow-code slide: Geist-aligned split.
 * Left rail: eyebrow, headline, three numbered steps, status dot.
 * Right: code card with mono filename + "use workflow" directive label.
 */
export async function FixSlideLayout({
  slide,
  headline,
  highlightSteps,
  workflowFix,
  steps,
  filename = "placeOrder.ts",
  statusLabel,
  statusTone = "fuchsia",
  markerLabel,
}: FixSlideLayoutProps) {
  const isAgent = isAgentGroupSlug(slide);
  const pillLabel = statusLabel ?? markerLabel;
  const strip = isAgent ? (
    <AgentBeatStrip slug={slide as AgentGroupSlug} />
  ) : (
    <FinishedTimelineStrip slide={slide} highlightSteps={highlightSteps} />
  );

  if ("progression" in workflowFix && workflowFix.progression) {
    const codeHtmls = await Promise.all(
      workflowFix.progression.map((state) =>
        highlight(state.code, "ts", state.highlightLines),
      ),
    );
    const extraTabs = await Promise.all(
      (workflowFix.tabs ?? []).map(async (tab) => {
        if ("progression" in tab && tab.progression) {
          const htmls = await Promise.all(
            tab.progression.map((state) =>
              highlight(state.code, tab.lang ?? "ts", state.highlightLines),
            ),
          );
          return { filename: tab.filename, htmls, tone: tab.tone };
        }
        const html = await highlight(tab.code, tab.lang ?? "ts", tab.highlightLines);
        return { filename: tab.filename, htmls: [html], tone: tab.tone };
      }),
    );
    return (
      <div className="flex h-full w-full flex-col gap-0 px-14 pt-14 pb-8">
        {strip}
        <div className="grid min-h-0 flex-1 grid-cols-[420px_minmax(0,1fr)] gap-10">
          <ProgressiveFixContent
            headline={headline}
            filename={filename}
            textClass="text-[26px]"
            steps={steps}
            codeHtmls={codeHtmls}
            extraTabs={extraTabs}
            pillLabel={pillLabel}
            statusTone={statusTone}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-0 px-14 pt-14 pb-8">
      {strip}

      <div className="grid min-h-0 flex-1 grid-cols-[420px_minmax(0,1fr)] gap-10">
        <div className="flex min-h-0 flex-col">
          <h2 className="mt-6 text-[44px] font-semibold leading-[46px] tracking-[-2.2px] text-white">
            {headline}
          </h2>

          <ol className="mt-8 flex flex-col gap-5">
            {steps.map((step, i) => (
              <li key={i} className="flex min-h-[78px] gap-5">
                <span className="pt-1.5 font-mono text-base leading-none uppercase tracking-[0.18em] text-zinc-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xl font-semibold leading-snug text-zinc-100">
                    {step.label}
                  </span>
                  <span className="font-mono text-lg leading-snug text-zinc-500">
                    {step.detail}
                  </span>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-auto min-h-[58px]" />
        </div>

        {workflowFix.tabs && workflowFix.tabs.length > 0 ? (
          <CodeEditorTabs
            tabs={await buildTabs(filename, workflowFix)}
            textClass="text-[26px]"
          />
        ) : (
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a]">
            <div className="flex min-h-[58px] items-center border-b border-white/10 px-6 py-4">
              <span className="font-mono text-base leading-none text-zinc-500">{filename}</span>
            </div>
            <div className="code-scroll-area min-h-0 flex-1 overflow-y-auto px-8 py-6">
              <CodeBlock code={workflowFix.code} lang="ts" textClass="text-[26px]" highlightLines={workflowFix.highlightLines} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
