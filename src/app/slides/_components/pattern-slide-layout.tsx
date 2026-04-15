import type { OrderStepId } from "@/lib/order-contract";
import { CopyablePrompt } from "./copyable-prompt";

type PatternSlideLayoutProps = {
  eyebrow: string;
  patternName: string;
  description: string;
  docUrl: string;
  docSection: string;
  apiPrimitive: string;
  prompt?: string;
  marker?: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
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
}: PatternSlideLayoutProps) {
  const docHref = docUrl.startsWith("http") ? docUrl : `https://${docUrl}`;
  const agentPrompt =
    prompt ??
    `npx workflow inspect run <run_id>

I just watched a demo of the Workflow SDK's "${patternName}" pattern,
and the run above is the one I saw. Ask me for the absolute path to my
project, cd there, then audit it for places this pattern would apply
and propose concrete diffs.

Docs: ${docHref}`;

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
