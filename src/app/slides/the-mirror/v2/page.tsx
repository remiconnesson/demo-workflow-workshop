export default function TheMirrorV2() {
  return (
    <div className="flex h-full w-full flex-col items-start justify-center gap-16 px-24">
      <h1 className="text-6xl font-medium tracking-tight">
        <span className="text-white">The same primitives. </span>
        <span className="text-zinc-500">Now handed to the AI.</span>
      </h1>

      <div className="flex flex-col gap-8 text-3xl">
        <div className="flex items-baseline gap-4">
          <span className="font-mono font-semibold uppercase tracking-widest text-sky-400">
            Retry
          </span>
          <span className="text-zinc-600">&mdash;</span>
          <span className="text-zinc-200">
            Observer crashed mid-loop — replayed without re-executing
          </span>
        </div>

        <div className="flex items-baseline gap-4">
          <span className="font-mono font-semibold uppercase tracking-widest text-amber-400">
            Suspend
          </span>
          <span className="text-zinc-600">&mdash;</span>
          <span className="text-zinc-200">
            Analyst paused for human approval, then resumed
          </span>
        </div>

        <div className="flex items-baseline gap-4">
          <span className="font-mono font-semibold uppercase tracking-widest text-fuchsia-400">
            Rollback
          </span>
          <span className="text-zinc-600">&mdash;</span>
          <span className="text-zinc-200">
            Agent undid its own decision when the operator said no
          </span>
        </div>
      </div>

      <div className="text-3xl font-medium tracking-tight">
        <span className="text-white">Three verbs. </span>
        <span className="text-zinc-500">Same verbs. Workflows or agents.</span>
      </div>
    </div>
  );
}
