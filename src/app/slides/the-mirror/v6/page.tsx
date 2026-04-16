export default function TheMirrorV6() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden p-16">
      {/* Header Row */}
      <header className="mb-16 flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-6xl font-bold tracking-tight text-white">The same primitives.</h1>
          <p className="text-6xl font-bold tracking-tight text-zinc-500">Now handed to the AI.</p>
        </div>
        <div className="flex flex-col gap-2 text-right">
          <h2 className="text-3xl font-bold text-white">Three verbs.</h2>
          <p className="text-2xl font-medium text-zinc-500">Same verbs. Workflows or agents.</p>
        </div>
      </header>

      {/* Dashboard Table */}
      <div className="mx-auto flex max-w-6xl flex-1 w-full flex-col justify-center">
        <div className="flex flex-col rounded-2xl border border-white/10 bg-zinc-950 p-10">
          <div className="flex items-center border-b border-white/10 py-4">
            <div className="w-1/3 font-mono text-2xl font-bold text-sky-400">Retry</div>
            <div className="w-2/3 text-xl text-zinc-300">Observer crashed mid-loop — replayed without re-executing</div>
          </div>
          <div className="flex items-center border-b border-white/10 py-4">
            <div className="w-1/3 font-mono text-2xl font-bold text-amber-400">Suspend</div>
            <div className="w-2/3 text-xl text-zinc-300">Analyst paused for human approval, then resumed</div>
          </div>
          <div className="flex items-center py-4">
            <div className="w-1/3 font-mono text-2xl font-bold text-fuchsia-400">Rollback</div>
            <div className="w-2/3 text-xl text-zinc-300">Agent undid its own decision when the operator said no</div>
          </div>
        </div>
      </div>
    </div>
  );
}
