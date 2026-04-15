export default function ThePivotSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-16 px-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        You now know the whole SDK
      </p>

      <h2 className="max-w-6xl text-7xl font-semibold leading-[1.05] tracking-tight text-white">
        Now watch what happens
        <br />
        <span className="text-zinc-500">when an AI uses it.</span>
      </h2>

      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 font-mono text-2xl tracking-[0.3em] text-zinc-600">
        <span>RETRY</span>
        <span aria-hidden>·</span>
        <span>SUSPEND</span>
        <span aria-hidden>·</span>
        <span>COMPENSATE</span>
        <span aria-hidden>·</span>
        <span>PERSIST</span>
      </div>
    </div>
  );
}
