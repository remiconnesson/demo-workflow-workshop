import { CodeBlock } from "../_components/code-block";
import { DurableAgentMock } from "../_components/durable-agent-mock";

const AGENT_CODE = `const agent = new DurableAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: 'Help pick the restaurant',
  tools: { search, checkMenu },
})
await agent.stream({ messages, writable })`;

export default async function OneMoreThingSlide() {
  return (
    <div className="flex h-full w-full flex-col gap-6 px-14 py-8">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
          14 · One more thing
        </div>
        <h2 className="mt-2 text-[44px] font-semibold leading-tight tracking-tight">
          An AI picks the restaurant.
          <span className="text-zinc-500"> Every guarantee above — for agents.</span>
        </h2>
      </div>

      <div className="min-h-0 flex-1">
        <DurableAgentMock />
      </div>

      <div className="rounded-2xl border border-sky-400/30 bg-zinc-950 px-8 py-6">
        <div className="flex items-center gap-8">
          <div className="min-w-[260px]">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300/80">
              DurableAgent
            </div>
            <div className="mt-2 font-sans text-xl leading-snug text-sky-100/80">
              Tool calls can be steps. The agent loop is a workflow.
            </div>
          </div>
          <div className="h-20 w-px bg-sky-400/20" />
          <div className="overflow-hidden rounded-xl border border-white/5 bg-black/60 px-6 py-4">
            <CodeBlock code={AGENT_CODE} lang="ts" textClass="text-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
