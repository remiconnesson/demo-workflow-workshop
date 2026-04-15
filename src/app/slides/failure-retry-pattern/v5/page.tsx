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

export default function V5() {
  return (
    <div className="flex h-full w-full items-center justify-center px-14">
      <div className="flex w-full max-w-6xl flex-col gap-6">
        <div className="flex items-baseline gap-6">
          <h2 className="text-7xl font-semibold tracking-tight">Idempotency</h2>
          <span className="font-mono text-xl text-zinc-500">
            → getStepMetadata().stepId
          </span>
        </div>
        <p className="text-xl leading-relaxed text-zinc-400">
          A stable step ID that survives retries. Send it as the dedup key to any external API.
        </p>
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
