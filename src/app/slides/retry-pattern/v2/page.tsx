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

export default function V2() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-14 py-10">
      <h2 className="font-serif text-[10rem] italic leading-none tracking-tight">
        Idempotency.
      </h2>
      <div className="flex items-center gap-6 font-mono text-xl text-zinc-400">
        <span className="rounded-full border border-white/15 bg-zinc-950 px-5 py-2 text-white">
          getStepMetadata().stepId
        </span>
        <span>→ stable across retries, safe to send twice</span>
      </div>
      <CopyablePrompt prompt={PROMPT} />
      <a
        href="https://workflow-sdk.dev/docs/cookbook/common-patterns/idempotency"
        target="_blank"
        rel="noreferrer"
        className="font-mono text-base text-zinc-500 underline decoration-zinc-800 underline-offset-4 hover:text-white"
      >
        workflow-sdk.dev/docs/cookbook/common-patterns/idempotency
      </a>
    </div>
  );
}
