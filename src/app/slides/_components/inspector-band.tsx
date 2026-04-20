"use client";

import { CopyablePrompt } from "./copyable-prompt";

const INSTALL_COMMAND =
  "npx skills add https://github.com/vercel/workflow";

type InspectorBandProps = {
  inspectPrompt?: string;
  comparePrompt?: string;
  patternName?: string;
  apiPrimitive?: string | string[];
  docUrl?: string;
  realWorldExamples?: string[];
};

export function InspectorBand({
  inspectPrompt,
  comparePrompt,
  patternName = "",
  apiPrimitive = "",
  docUrl = "",
  realWorldExamples,
}: InspectorBandProps) {
  const primitiveStr = Array.isArray(apiPrimitive)
    ? apiPrimitive.join(", ")
    : apiPrimitive;

  const examplesBlock =
    realWorldExamples && realWorldExamples.length > 0
      ? `\n\nReal-world scenarios to look for:\n${realWorldExamples.map((ex) => `- ${ex}`).join("\n")}\n\nUse these as starting points to find similar patterns in my codebase.`
      : "";

  const leftPrompt =
    inspectPrompt ??
    `npx workflow inspect run <run_id>

Explain this run to me in detail. Walk me through each step that executed, what state transitions happened, and how the "${patternName}" pattern played out. I want to understand exactly what the Workflow SDK did under the hood.`;

  const rightPrompt =
    comparePrompt ??
    `Compare my current code to what it might look like if I was using the Workflow SDK's "${patternName}" pattern. Ask me for the absolute path to my project, cd there, then find the places this pattern would apply and show me before/after diffs.

API primitive: ${primitiveStr}
Docs: ${docUrl}${examplesBlock}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <CopyablePrompt prompt={leftPrompt} label="Inspect the run" />
        <CopyablePrompt prompt={rightPrompt} label="Try it on your code" />
      </div>
      <CopyablePrompt
        prompt={INSTALL_COMMAND}
        label="Install the skill"
        compact
      />
    </div>
  );
}
