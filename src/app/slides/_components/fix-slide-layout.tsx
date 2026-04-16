import { codeToHtml } from "shiki";
import type { OrderStepId } from "@/lib/order-contract";
import { isAgentGroupSlug, type AgentGroupSlug, type SlideGroupSlug } from "../_data/agent-groups";
import { AgentBeatStrip } from "./agent-beat-strip";
import { CodeBlock } from "./code-block";
import { CodeEditorTabs, type CodeEditorTab } from "./code-editor-tabs";
import { FinishedTimelineStrip } from "./finished-timeline-strip";

export type WorkflowFixTab = {
  filename: string;
  code: string;
  lang?: "ts" | "tsx" | "js" | "jsx";
};

export type WorkflowFix = {
  code: string;
  /**
   * Optional additional tabs. When provided, the code pane renders as a
   * tabbed editor with the primary `code` as the first tab (labelled
   * `filename` with the `use workflow` directive) and these as extras.
   */
  tabs?: WorkflowFixTab[];
};

export type FixStep = { label: string; detail: string };

type StatusTone = "fuchsia" | "red" | "amber" | "sky" | "emerald";

type FixSlideLayoutProps = {
  slide: SlideGroupSlug;
  eyebrow: string;
  headline: string;
  marker: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
  highlightSteps?: OrderStepId[];
  workflowFix: WorkflowFix;
  steps: [FixStep, FixStep, FixStep];
  filename?: string;
  statusLabel?: string;
  statusTone?: StatusTone;
};

async function highlight(code: string, lang: "ts" | "tsx" | "js" | "jsx" = "ts") {
  return codeToHtml(code, {
    lang,
    theme: "github-dark-default",
    structure: "inline",
  });
}

async function buildTabs(
  primaryFilename: string,
  workflowFix: WorkflowFix,
): Promise<CodeEditorTab[]> {
  const primary: CodeEditorTab = {
    filename: primaryFilename,
    html: await highlight(workflowFix.code, "ts"),
  };
  const extras = await Promise.all(
    (workflowFix.tabs ?? []).map(async (tab) => ({
      filename: tab.filename,
      html: await highlight(tab.code, tab.lang ?? "ts"),
    })),
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
 * Workflow-code slide — Geist-aligned split.
 * Left rail: eyebrow, headline, three numbered steps, status dot.
 * Right: code card with mono filename + "use workflow" directive label.
 */
export async function FixSlideLayout({
  slide,
  eyebrow,
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

  return (
    <div className="flex h-full w-full flex-col gap-6 px-14 py-8">
      {isAgent ? (
        <AgentBeatStrip slug={slide as AgentGroupSlug} />
      ) : (
        <FinishedTimelineStrip slide={slide} highlightSteps={highlightSteps} />
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr] gap-12">
        <div className="flex flex-col">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">
            {eyebrow}
          </div>
          <h2
            className="mt-6 text-[44px] font-semibold text-white"
            style={{ lineHeight: "46px", letterSpacing: "-2.2px" }}
          >
            {headline}
          </h2>

          <ol className="mt-8 flex flex-col gap-4">
            {steps.map((step, i) => (
              <li key={step.label} className="flex gap-4">
                <span className="pt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] font-medium text-zinc-100">
                    {step.label}
                  </span>
                  <span className="font-mono text-[12px] text-zinc-500">
                    {step.detail}
                  </span>
                </div>
              </li>
            ))}
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

        {workflowFix.tabs && workflowFix.tabs.length > 0 ? (
          <CodeEditorTabs
            tabs={await buildTabs(filename, workflowFix)}
            textClass="text-[26px]"
          />
        ) : (
          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0a0a0a]">
            <div className="flex items-center border-b border-white/10 px-6 py-3">
              <span className="font-mono text-[12px] text-zinc-500">{filename}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
              <CodeBlock code={workflowFix.code} lang="ts" textClass="text-[26px]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
