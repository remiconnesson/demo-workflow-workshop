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

export default function V1() {
  return (
    <div className="grid h-full w-full grid-cols-[5fr_6fr] gap-12 px-16 py-12">
      <div className="flex flex-col justify-center gap-8">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-600">
          Cookbook · Common Patterns
        </div>
        <h2 className="text-[8rem] font-semibold leading-[0.95] tracking-tight">
          Idempotency
        </h2>
        <p className="max-w-md text-xl leading-relaxed text-zinc-400">
          A stable, deterministic step ID that survives retries. Pass it to
          external APIs as the deduplication key.
        </p>
        <div className="inline-flex w-fit rounded-xl border border-white/10 bg-zinc-950 px-6 py-3 font-mono text-2xl">
          getStepMetadata().stepId
        </div>
        <a
          href="https://workflow-sdk.dev/docs/cookbook/common-patterns/idempotency"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-base text-zinc-500 underline decoration-zinc-800 underline-offset-4 hover:text-white"
        >
          workflow-sdk.dev/docs/cookbook/common-patterns/idempotency
        </a>
      </div>
      <div className="flex items-center">
        <CopyablePrompt prompt={PROMPT} />
      </div>
    </div>
  );
}
