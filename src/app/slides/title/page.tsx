import { WorkflowMark } from "../_components/workflow-mark";

export default function TitleSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-20">
      <WorkflowMark size={80} className="text-white" />

      <h1 className="text-8xl font-semibold tracking-tight text-center">
        Workflow SDK
      </h1>

      <p className="text-3xl text-zinc-400 text-center max-w-3xl">
        Durable workflows for the rest of us. Tonight.
      </p>

      <div className="mt-16 flex items-center gap-8">
        <span className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-mono text-xl text-zinc-400">
          &quot;use workflow&quot;
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-mono text-xl text-zinc-400">
          &quot;use step&quot;
        </span>
      </div>

      <div className="mt-16 flex flex-col items-center gap-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Follow along
        </p>
        <code className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-mono text-2xl text-white">
          github.com/vercel-labs/workflow-ga-slides
        </code>
        <p className="font-mono text-lg text-zinc-500">
          git clone &amp;&amp; pnpm install &amp;&amp; pnpm dev
        </p>
      </div>

      <p className="mt-12 text-xl text-zinc-600 animate-pulse">
        Press &rarr; to begin
      </p>
    </div>
  );
}
