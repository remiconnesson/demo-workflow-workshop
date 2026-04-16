export default function TheMirrorV4() {
  return (
    <div className="flex h-full w-full flex-col p-20">
      <div className="flex flex-1 gap-20">
        <div className="flex w-[40%] flex-col justify-center">
          <h1 className="text-6xl font-medium leading-tight tracking-tight">
            <span className="text-white">The same primitives.</span>
            <br />
            <span className="text-zinc-500">Now handed to the AI.</span>
          </h1>
        </div>

        <div className="flex w-[60%] flex-col justify-center">
          <div className="flex flex-col rounded-2xl border border-white/10 bg-zinc-950 p-10">
            <div className="flex flex-col gap-4 pb-8">
              <span className="font-mono text-2xl text-sky-400">Retry</span>
              <p className="text-lg text-zinc-300">
                Observer crashed mid-loop — replayed without re-executing
              </p>
            </div>

            <div className="h-px w-full bg-white/5" />

            <div className="flex flex-col gap-4 py-8">
              <span className="font-mono text-2xl text-amber-400">Suspend</span>
              <p className="text-lg text-zinc-300">
                Analyst paused for human approval, then resumed
              </p>
            </div>

            <div className="h-px w-full bg-white/5" />

            <div className="flex flex-col gap-4 pt-8">
              <span className="font-mono text-2xl text-fuchsia-400">Rollback</span>
              <p className="text-lg text-zinc-300">
                Agent undid its own decision when the operator said no
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-white/10 pt-10">
        <p className="text-xl font-semibold uppercase tracking-[0.2em]">
          <span className="text-white">Three verbs. </span>
          <span className="text-zinc-500">Same verbs. Workflows or agents.</span>
        </p>
      </div>
    </div>
  );
}
