import { CopyablePrompt } from "../../_components/copyable-prompt";

const PROMPT = `I just watched a demo of the Workflow SDK's Idempotency pattern.

Ask me for the absolute path to my project, cd there, then find
external side effects that can't safely run twice — payments, messaging,
webhooks, queues, LLM calls — and propose diffs that wrap each call in
a "use step" function and pass getStepMetadata().stepId as the
idempotency key.

Context from the run I just watched:
npx workflow inspect run <run_id>

Docs: https://workflow-sdk.dev/docs/cookbook/common-patterns/idempotency`;

export default function V4() {
  return (
    <div className="flex h-full w-full flex-col gap-8 px-16 py-12">
      <div className="flex items-end justify-between gap-10 border-b border-white/10 pb-8">
        <h2 className="text-8xl font-semibold tracking-tight">Idempotency</h2>
        <div className="rounded-xl border border-white/10 bg-zinc-950 px-6 py-3 font-mono text-2xl">
          getStepMetadata().stepId
        </div>
      </div>
      <p className="text-2xl leading-relaxed text-zinc-400">
        Every step gets a deterministic ID. Pass it to external APIs as the dedup key — retries stay safe.
      </p>
      <div className="flex flex-1 items-center justify-center">
        <CopyablePrompt prompt={PROMPT} />
      </div>
      <a
        href="https://workflow-sdk.dev/docs/cookbook/common-patterns/idempotency"
        target="_blank"
        rel="noreferrer"
        className="self-end font-mono text-base text-zinc-500 underline decoration-zinc-800 underline-offset-4 hover:text-white"
      >
        workflow-sdk.dev/docs/cookbook/common-patterns/idempotency
      </a>
    </div>
  );
}
