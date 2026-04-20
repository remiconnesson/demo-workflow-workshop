export default function ThePivotSlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col items-center justify-center gap-24 px-40 text-center">
      <div className="flex flex-col items-center gap-6">
        <h2 className="max-w-[1800px] text-9xl font-semibold leading-[1.05] tracking-tight text-white">
          Agents,
          <br />
          <span className="text-zinc-500">meet reliability.</span>
        </h2>
        <p className="max-w-4xl text-3xl leading-snug text-zinc-400">
          Same Concepts. AI-Powered.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 font-mono text-[44px] font-semibold leading-none tracking-tight">
        <span className="text-sky-400">Stable</span>
        <span aria-hidden className="text-zinc-700">·</span>
        <span className="text-amber-400">Suspendable</span>
        <span aria-hidden className="text-zinc-700">·</span>
        <span className="text-fuchsia-400">Undoable</span>
      </div>
    </div>
  );
}
