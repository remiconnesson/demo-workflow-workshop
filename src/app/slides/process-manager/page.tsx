import { Kw, Fn, Str, Cmt, Punc } from "../_components/code-tokens";

export default function ProcessManagerSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: state machine visual */}
      <div className="flex-1 max-w-lg">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Next Pattern
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          State machines as code
        </h2>

        <div className="mt-8 flex flex-col gap-0">
          {[
            { state: "received", color: "border-sky-400 bg-sky-400/10 text-sky-300", next: "validate payment" },
            { state: "payment_validated", color: "border-emerald-400 bg-emerald-400/10 text-emerald-300", next: "check inventory" },
            { state: "inventory_checked", color: "border-emerald-400 bg-emerald-400/10 text-emerald-300", next: "reserve items" },
            { state: "reserved", color: "border-emerald-400 bg-emerald-400/10 text-emerald-300", next: "ship" },
            { state: "shipped", color: "border-amber-400 bg-amber-400/10 text-amber-300", next: "await delivery" },
            { state: "delivered", color: "border-white bg-white/10 text-white", next: null },
          ].map((s, i, arr) => (
            <div key={s.state}>
              <div className={`flex items-center gap-4 rounded-xl border px-6 py-4 ${s.color}`}>
                <span className="font-mono text-lg font-semibold">{s.state}</span>
              </div>
              {s.next && (
                <div className="ml-8 flex items-center gap-2 py-2">
                  <div className="h-6 w-[2px] bg-white/10" />
                  <span className="text-sm text-zinc-500 ml-2">{s.next}</span>
                </div>
              )}
            </div>
          ))}

          {/* Branch: payment failed */}
          <div className="mt-4 ml-8 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" className="text-red-400 shrink-0">
              <path d="M0 0 L16 8 L0 16 Z" fill="currentColor" />
            </svg>
            <span className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-2 font-mono text-base text-red-300">
              payment_failed &rarr; cancelled
            </span>
          </div>
          <div className="mt-2 ml-8 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" className="text-amber-400 shrink-0">
              <path d="M0 0 L16 8 L0 16 Z" fill="currentColor" />
            </svg>
            <span className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2 font-mono text-base text-amber-300">
              backordered &rarr; sleep(5s) &rarr; recheck
            </span>
          </div>
        </div>
      </div>

      {/* Right: code */}
      <div className="flex-1 max-w-xl">
        <pre className="rounded-2xl border border-white/10 bg-zinc-950 p-8 font-mono text-xl leading-relaxed overflow-hidden">
          <Kw>let</Kw> state = <Str>&quot;received&quot;</Str>{"\n"}
          {"\n"}
          <Kw>const</Kw> payment = <Kw>await</Kw> <Fn>validatePayment</Fn><Punc>(</Punc>id<Punc>)</Punc>{"\n"}
          <Kw>if</Kw> <Punc>(</Punc>payment === <Str>&quot;failed&quot;</Str><Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
          {"  "}<Kw>await</Kw> <Fn>cancelOrder</Fn><Punc>(</Punc>id<Punc>)</Punc>{"\n"}
          {"  "}<Kw>return</Kw> <Punc>{"{"}</Punc> state: <Str>&quot;cancelled&quot;</Str> <Punc>{"}"}</Punc>{"\n"}
          <Punc>{"}"}</Punc>{"\n"}
          state = <Str>&quot;payment_validated&quot;</Str>{"\n"}
          {"\n"}
          <Kw>const</Kw> inv = <Kw>await</Kw> <Fn>checkInventory</Fn><Punc>(</Punc>items<Punc>)</Punc>{"\n"}
          <Kw>if</Kw> <Punc>(</Punc>inv === <Str>&quot;backordered&quot;</Str><Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
          {"  "}<Kw>await</Kw> <Fn>sleep</Fn><Punc>(</Punc><Str>&quot;5s&quot;</Str><Punc>)</Punc>{"\n"}
          {"  "}<Kw>await</Kw> <Fn>recheckInventory</Fn><Punc>(</Punc>items<Punc>)</Punc>{"\n"}
          <Punc>{"}"}</Punc>{"\n"}
          state = <Str>&quot;inventory_checked&quot;</Str>
        </pre>

        <p className="mt-6 text-xl text-zinc-400">
          No state machine library. No external orchestrator. Just <span className="font-mono text-white">if/else</span> and{" "}
          <span className="font-mono text-white">await</span> — the runtime makes it durable.
        </p>
      </div>
    </div>
  );
}
