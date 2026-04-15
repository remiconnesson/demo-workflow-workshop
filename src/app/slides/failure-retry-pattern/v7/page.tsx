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

export default function V7() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center px-14 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[12%] text-center font-mono text-[12rem] font-bold tracking-tight text-white/[0.04]"
      >
        stepId
      </div>
      <div className="relative flex flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-3">
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Idempotency
          </div>
          <div className="font-mono text-4xl text-white">
            getStepMetadata().stepId
          </div>
          <p className="max-w-2xl text-center text-lg text-zinc-500">
            Stable across retries · pass as the dedup key
          </p>
        </div>
        <CopyablePrompt prompt={PROMPT} />
        <a
          href="https://useworkflow.dev/docs/cookbook/common-patterns/idempotency"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-sm text-zinc-600 underline decoration-zinc-800 underline-offset-4 hover:text-white"
        >
          useworkflow.dev/docs/cookbook/common-patterns/idempotency
        </a>
      </div>
    </div>
  );
}
