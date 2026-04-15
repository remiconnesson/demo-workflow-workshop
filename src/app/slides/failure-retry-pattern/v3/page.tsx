import { CopyablePrompt } from "../../_components/copyable-prompt";

const PROMPT = `I just watched a demo of the Workflow SDK's Idempotency pattern.

Ask me for the absolute path to my project, cd there, then find
external side effects that can't safely run twice — payments, messaging,
webhooks, queues, LLM calls — and propose diffs that wrap each call in
a "use step" function and pass getStepMetadata().stepId as the
idempotency key.

Context from the run I just watched:
npx workflow inspect run <run_id>

Docs: https://useworkflow.dev/docs/cookbook/common-patterns/idempotency`;

export default function V3() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-14 py-10">
      <div className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
        Idempotency · Cookbook
      </div>
      <div className="font-mono text-7xl tracking-tight text-white">
        getStepMetadata().<span className="text-emerald-400">stepId</span>
      </div>
      <p className="max-w-3xl text-center text-2xl leading-relaxed text-zinc-400">
        One stable ID per step. Same on retry. Send it as the dedup key.
      </p>
      <CopyablePrompt prompt={PROMPT} />
    </div>
  );
}
