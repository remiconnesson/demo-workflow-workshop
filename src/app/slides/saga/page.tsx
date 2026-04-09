import { Kw, Fn, Cmt, Punc } from "../_components/code-tokens";

export default function SagaSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: LIFO stack visual */}
      <div className="flex-1 max-w-lg">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Saga Pattern
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Fail forward, unwind backward
        </h2>

        <div className="mt-10 flex flex-col gap-3">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-400">
            Compensation Stack (LIFO)
          </div>

          {/* Arrow showing unwind direction */}
          <div className="flex items-center gap-4 py-2">
            <span className="text-lg text-zinc-500">Undo order &darr;</span>
          </div>

          {/* Stack entries */}
          <div className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/5 px-8 py-5 font-mono text-2xl">
            <span className="text-fuchsia-300 font-semibold">3.</span>
            <span className="ml-4 text-zinc-200">releaseDriver</span>
          </div>

          <div className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/5 px-8 py-5 font-mono text-2xl">
            <span className="text-fuchsia-300 font-semibold">2.</span>
            <span className="ml-4 text-zinc-200">cancelRestaurantOrder</span>
          </div>

          <div className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/5 px-8 py-5 font-mono text-2xl">
            <span className="text-fuchsia-300 font-semibold">1.</span>
            <span className="ml-4 text-zinc-200">refundPayment</span>
          </div>

          <p className="mt-4 text-xl text-zinc-500">
            Last pushed = first undone
          </p>
        </div>
      </div>

      {/* Right: code */}
      <div className="flex-1 max-w-2xl">
        <pre className="rounded-2xl border border-fuchsia-500/20 bg-zinc-950 p-10 font-mono text-2xl leading-relaxed overflow-hidden">
          <Cmt>{"// after each step, push its undo"}</Cmt>{"\n"}
          <Kw>const</Kw> payment = <Kw>await</Kw> <Fn>chargePayment</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
          compensations.<Fn>push</Fn><Punc>({"{"}</Punc>{"\n"}
          {"  "}action: <span className="text-amber-300">&quot;refundPayment&quot;</span>,{"\n"}
          {"  "}undo: <Punc>()</Punc> <Punc>=&gt;</Punc> <Fn>refundPayment</Fn><Punc>(</Punc>id, payment<Punc>)</Punc>{"\n"}
          <Punc>{"})"}</Punc>{"\n"}
          {"\n"}
          <Cmt>{"// on failure: unwind in reverse"}</Cmt>{"\n"}
          <Kw>while</Kw> <Punc>(</Punc>compensations.length &gt; 0<Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
          {"  "}<Kw>const</Kw> c = compensations.<Fn>pop</Fn><Punc>()</Punc>{"\n"}
          {"  "}<Kw>await</Kw> c.<Fn>undo</Fn><Punc>()</Punc>{"\n"}
          <Punc>{"}"}</Punc>
        </pre>

        <p className="mt-6 text-xl text-zinc-400">
          Each step registers a compensation. On <span className="text-red-400 font-mono">FatalError</span>,
          the stack unwinds &mdash; refund, cancel, release &mdash; automatically.
        </p>
      </div>
    </div>
  );
}
