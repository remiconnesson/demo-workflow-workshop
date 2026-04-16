export default function HowItWorksSlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col justify-center gap-14 px-20">
      <h2 className="text-5xl font-semibold tracking-tight">
        This presentation is divided into groups of 3 slides
      </h2>

      <div className="flex items-center gap-4">
        {/* Demo card */}
        <div className="flex w-0 flex-1 flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-950 p-10">
          <p className="text-xl font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Demo
          </p>
          {/* Mini phone + timeline mockup */}
          <div className="flex items-center gap-6">
            <div className="flex h-44 w-24 flex-col items-center justify-center rounded-2xl border border-white/10 bg-zinc-900">
              <div className="mb-3 h-2 w-10 rounded-full bg-zinc-700" />
              <div className="h-2.5 w-12 rounded bg-zinc-700" />
              <div className="mt-2 h-2.5 w-9 rounded bg-zinc-700/60" />
              <div className="mt-2 h-2.5 w-11 rounded bg-red-500/40" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-emerald-400/60" />
                <div className="h-2 w-16 rounded bg-zinc-700" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-emerald-400/60" />
                <div className="h-2 w-14 rounded bg-zinc-700" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-red-400/60" />
                <div className="h-2 w-20 rounded bg-zinc-700" />
              </div>
            </div>
          </div>
          <p className="text-2xl leading-snug text-zinc-400">
            See the problem play out live.
          </p>
        </div>

        {/* Arrow */}
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0 text-zinc-600"
        >
          <path
            d="M5 12h14m0 0-5-5m5 5-5 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Solution card */}
        <div className="flex w-0 flex-1 flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-950 p-10">
          <p className="text-xl font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Solution
          </p>
          {/* Mini code editor mockup */}
          <div className="overflow-x-auto whitespace-nowrap rounded-xl border border-white/10 bg-zinc-900 p-5 font-mono text-base leading-loose">
            <div className="flex items-center gap-3 text-zinc-600">
              <span className="text-zinc-500">1</span>
              <span>
                <span className="text-fuchsia-400/70">async function</span>{" "}
                <span className="text-zinc-300">charge</span>
                <span className="text-zinc-500">() {"{"}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-zinc-600">
              <span className="text-zinc-500">2</span>
              <span className="pl-5">
                <span className="text-amber-400/70">&quot;use step&quot;</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-zinc-600">
              <span className="text-zinc-500">3</span>
              <span className="pl-5 text-zinc-500">// ...</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-600">
              <span className="text-zinc-500">4</span>
              <span className="text-zinc-500">{"}"}</span>
            </div>
          </div>
          <p className="text-2xl leading-snug text-zinc-400">
            Fix it with a few lines of code.
          </p>
        </div>

        {/* Arrow */}
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0 text-zinc-600"
        >
          <path
            d="M5 12h14m0 0-5-5m5 5-5 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Pattern card */}
        <div className="flex w-0 flex-1 flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-950 p-10">
          <p className="text-xl font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Pattern
          </p>
          {/* Mini definition mockup */}
          <div className="flex flex-col gap-4">
            <p className="text-3xl font-semibold tracking-tight text-white">
              Idempotency
            </p>
            <p className="text-base leading-relaxed text-zinc-500">
              Every step gets a stable, deterministic ID that doesn&apos;t
              change across retries.
            </p>
            <div className="mt-1 flex items-center gap-3">
              <span className="rounded bg-zinc-800 px-2.5 py-1 font-mono text-sm text-zinc-400">
                stepId
              </span>
              <span className="h-px flex-1 bg-zinc-800" />
              <span className="text-sm text-zinc-600">docs &rarr;</span>
            </div>
          </div>
          <p className="text-2xl leading-snug text-zinc-400">
            Understand the pattern behind it.
          </p>
        </div>
      </div>
    </div>
  );
}
