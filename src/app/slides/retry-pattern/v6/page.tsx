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

export default function V6() {
  return (
    <div className="grid h-full w-full grid-cols-[1fr_2fr] gap-16 px-16 py-12">
      <aside className="flex flex-col justify-between border-r border-white/10 pr-12">
        <div className="flex flex-col gap-6">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-600">
            Pattern · 05
          </div>
          <h2 className="text-7xl font-semibold leading-[0.95] tracking-tight">
            Idem&shy;potency
          </h2>
          <div className="font-mono text-lg text-zinc-400">
            getStepMetadata()
            <br />
            .stepId
          </div>
        </div>
        <a
          href="https://workflow-sdk.dev/docs/cookbook/common-patterns/idempotency"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-zinc-500 underline decoration-zinc-800 underline-offset-4 hover:text-white"
        >
          workflow-sdk.dev/docs/
          <br />
          cookbook/common-patterns/
          <br />
          idempotency
        </a>
      </aside>
      <div className="flex flex-col justify-center gap-8">
        <p className="max-w-2xl text-3xl leading-snug text-zinc-300">
          One stable ID per step. Same on every retry.{" "}
          <span className="text-zinc-500">
            Send it as the dedup key so external APIs charge once, email once, publish once.
          </span>
        </p>
        <CopyablePrompt prompt={PROMPT} />
      </div>
    </div>
  );
}
