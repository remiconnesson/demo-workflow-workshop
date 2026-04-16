export default function TheMirrorV3() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-between overflow-hidden px-10 py-20">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-tight">
          <span className="text-white">The same primitives.</span>{" "}
          <span className="text-zinc-500">Now handed to the AI.</span>
        </h1>
      </div>

      <div className="flex flex-col items-center gap-16">
        <div className="flex flex-row items-center justify-center gap-10">
          <div className="rounded-full border border-sky-400/30 bg-sky-400/5 px-8 py-3 font-mono text-2xl text-sky-400">
            Retry
          </div>
          <div className="rounded-full border border-amber-400/30 bg-amber-400/5 px-8 py-3 font-mono text-2xl text-amber-400">
            Suspend
          </div>
          <div className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/5 px-8 py-3 font-mono text-2xl text-fuchsia-400">
            Rollback
          </div>
        </div>

        <div className="flex flex-col items-center gap-8 text-xl text-zinc-300">
          <p>Observer crashed mid-loop — replayed without re-executing</p>
          <p>Analyst paused for human approval, then resumed</p>
          <p>Agent undid its own decision when the operator said no</p>
        </div>
      </div>

      <div className="text-center">
        <p className="text-3xl font-medium">
          <span className="text-white">Three verbs.</span>{" "}
          <span className="text-zinc-500">Same verbs. Workflows or agents.</span>
        </p>
      </div>
    </div>
  );
}
