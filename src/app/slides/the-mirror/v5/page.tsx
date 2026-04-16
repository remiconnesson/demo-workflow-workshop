export default function TheMirrorV5() {
  return (
    <div className="flex h-full w-full flex-col justify-between p-24">
      <header>
        <h1 className="text-4xl font-medium tracking-tight">
          <span className="text-white">The same primitives. </span>
          <span className="text-zinc-500">Now handed to the AI.</span>
        </h1>
      </header>

      <main className="flex max-w-6xl flex-grow flex-col justify-center gap-12">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-4 leading-normal">
          <span className="font-mono text-7xl text-sky-400">Retry</span>
          <span className="mt-3 self-center text-2xl text-zinc-400">
            &mdash; Observer crashed mid-loop &mdash; replayed without re-executing
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-4 leading-normal">
          <span className="font-mono text-7xl text-amber-400">Suspend</span>
          <span className="mt-3 self-center text-2xl text-zinc-400">
            &mdash; Analyst paused for human approval, then resumed
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-4 leading-normal">
          <span className="font-mono text-7xl text-fuchsia-400">Rollback</span>
          <span className="mt-3 self-center text-2xl text-zinc-400">
            &mdash; Agent undid its own decision when the operator said no
          </span>
        </div>
      </main>

      <footer>
        <p className="text-2xl font-medium">
          <span className="text-white">Three verbs. </span>
          <span className="text-zinc-500">Same verbs. Workflows or agents.</span>
        </p>
      </footer>
    </div>
  );
}
