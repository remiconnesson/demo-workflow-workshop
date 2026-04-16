import type { ReactNode } from "react";
import type { OrderStepId } from "@/lib/order-contract";
import { CopyablePrompt } from "./copyable-prompt";

type PatternSlideLayoutProps = {
  eyebrow: string;
  patternName: string;
  description: ReactNode;
  docUrl: string;
  docSection: string;
  apiPrimitive: string;
  prompt?: string;
  marker?: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
  realWorldExamples?: string[];
};

/**
 * The "concept / pattern" slide — fourth beat per concept in Act 2.
 * Teaches the SDK vocabulary and gives the audience a breadcrumb
 * to the docs. Clean, one-concept, photo-friendly (audience
 * captures the URL from this slide).
 */
export function PatternSlideLayout({
  patternName,
  description,
  docUrl,
  apiPrimitive,
  prompt,
  realWorldExamples,
}: PatternSlideLayoutProps) {
  const docHref = docUrl.startsWith("http") ? docUrl : `https://${docUrl}`;
  const examplesBlock =
    realWorldExamples && realWorldExamples.length > 0
      ? `\n\nReal-world scenarios to brainstorm around:\n${realWorldExamples.map((ex) => `- ${ex}`).join("\n")}\n\nUse these as starting points to find similar patterns in my codebase.`
      : "";
  const basePrompt =
    prompt ??
    `npx workflow inspect run <run_id>

I just watched a demo of the Workflow SDK's "${patternName}" pattern,
and the run above is the one I saw. Ask me for the absolute path to my
project, cd there, then audit it for places this pattern would apply
and propose concrete diffs.

Docs: ${docHref}`;
  const agentPrompt = basePrompt + examplesBlock;

  return (
    <div className="flex h-full w-full items-center justify-center px-14">
      <div className="flex w-full max-w-6xl flex-col gap-6">
        <div className="flex items-baseline gap-6">
          <h2 className="text-7xl font-semibold tracking-tight">
            {patternName}
          </h2>
          <span className="font-mono text-xl text-zinc-500">
            → {apiPrimitive}
          </span>
        </div>
        <p className="text-xl leading-relaxed text-zinc-400">{description}</p>
        {realWorldExamples && realWorldExamples.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Where you&apos;ll see this
            </p>
            <ul className="flex flex-wrap gap-3">
              {realWorldExamples.map((ex) => (
                <li
                  key={ex}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-lg text-zinc-300"
                >
                  {ex}
                </li>
              ))}
            </ul>
          </div>
        )}
        <CopyablePrompt prompt={agentPrompt} />
        <a
          href={docHref}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-sm text-zinc-600 underline decoration-zinc-800 underline-offset-4 hover:text-white"
        >
          {docUrl}
        </a>
      </div>
    </div>
  );
}
