import { Kw, Fn, Str, Cmt, Punc } from "../_components/code-tokens";

export default function ParallelSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: code */}
      <div className="flex-1 max-w-2xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Parallel Execution
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Promise.all — just works
        </h2>

        <pre className="mt-8 rounded-2xl border border-white/10 bg-zinc-950 p-8 font-mono text-2xl leading-relaxed overflow-hidden">
          <Cmt>{"// Run 3 steps in parallel"}</Cmt>{"\n"}
          <Kw>const</Kw> <Punc>[</Punc>menu, driver, history<Punc>]</Punc> ={"\n"}
          {"  "}<Kw>await</Kw> Promise.<Fn>all</Fn><Punc>([</Punc>{"\n"}
          {"    "}<Fn>fetchMenu</Fn><Punc>(</Punc>restaurantId<Punc>)</Punc>,{"\n"}
          {"    "}<Fn>findDriver</Fn><Punc>(</Punc>location<Punc>)</Punc>,{"\n"}
          {"    "}<Fn>getHistory</Fn><Punc>(</Punc>customerId<Punc>)</Punc>,{"\n"}
          {"  "}<Punc>])</Punc>
        </pre>

        <p className="mt-6 text-xl text-zinc-400">
          Standard <span className="font-mono text-white">Promise.all</span> — no new API. Each branch is a durable step.
          If one fails, the others still complete.
        </p>
      </div>

      {/* Right: visual fan-out */}
      <div className="flex-1 max-w-md">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Execution flow
          </div>

          <div className="mt-6 flex flex-col items-center gap-4">
            {/* Single trigger */}
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-sky-400 text-sky-300 text-xl font-semibold">
              <span className="animate-pulse">●</span>
            </div>
            <div className="font-mono text-lg text-zinc-400">Promise.all</div>

            {/* Fan-out lines */}
            <div className="flex items-start gap-8">
              <div className="h-8 w-[2px] bg-white/10" />
              <div className="h-8 w-[2px] bg-white/10" />
              <div className="h-8 w-[2px] bg-white/10" />
            </div>

            {/* Parallel branches */}
            <div className="flex gap-6">
              {[
                { label: "fetchMenu", status: "2.1s", color: "border-emerald-400 text-emerald-300 bg-emerald-500/10" },
                { label: "findDriver", status: "0.8s", color: "border-emerald-400 text-emerald-300 bg-emerald-500/10" },
                { label: "getHistory", status: "1.4s", color: "border-emerald-400 text-emerald-300 bg-emerald-500/10" },
              ].map((b) => (
                <div key={b.label} className="flex flex-col items-center gap-2">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-semibold ${b.color}`}>
                    &#x2713;
                  </div>
                  <div className="font-mono text-sm text-zinc-300">{b.label}</div>
                  <div className="font-mono text-xs text-zinc-500">{b.status}</div>
                </div>
              ))}
            </div>

            {/* Converge lines */}
            <div className="flex items-start gap-8">
              <div className="h-8 w-[2px] bg-white/10" />
              <div className="h-8 w-[2px] bg-white/10" />
              <div className="h-8 w-[2px] bg-white/10" />
            </div>

            {/* Result */}
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-white text-black text-xl font-semibold">
              &#x2713;
            </div>
            <div className="font-mono text-lg text-zinc-400">
              Total: 2.1s <span className="text-zinc-600">(not 4.3s)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
