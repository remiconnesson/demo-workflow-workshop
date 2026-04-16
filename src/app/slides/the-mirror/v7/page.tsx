export default function TheMirrorV7() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-24 overflow-hidden px-32 py-20">
      <h1 className="text-6xl font-medium tracking-tight">
        <span className="text-white">The same primitives. </span>
        <span className="text-zinc-500">Now handed to the AI.</span>
      </h1>

      <div className="flex w-full max-w-6xl flex-col gap-12">
        <div className="border-l-4 border-sky-400 py-4 pl-8">
          <span className="font-mono text-3xl text-sky-400">Retry</span>
          <span className="ml-4 text-xl text-zinc-300">— Observer crashed mid-loop — replayed without re-executing</span>
        </div>

        <div className="border-l-4 border-amber-400 py-4 pl-8">
          <span className="font-mono text-3xl text-amber-400">Suspend</span>
          <span className="ml-4 text-xl text-zinc-300">— Analyst paused for human approval, then resumed</span>
        </div>

        <div className="border-l-4 border-fuchsia-400 py-4 pl-8">
          <span className="font-mono text-3xl text-fuchsia-400">Rollback</span>
          <span className="ml-4 text-xl text-zinc-300">— Agent undid its own decision when the operator said no</span>
        </div>
      </div>

      <div className="text-3xl">
        <span className="text-white">Three verbs. </span>
        <span className="text-zinc-500">Same verbs. Workflows or agents.</span>
      </div>
    </div>
  );
}
