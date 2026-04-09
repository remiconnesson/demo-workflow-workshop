import { Kw, Dir, Fn, Cmt, Punc, Str } from "../_components/code-tokens";
import { TriangleMark } from "../_components/triangle-mark";

export default function WorkflowCodeSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: the real workflow code */}
      <div className="flex-1 max-w-2xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          The Real Code
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          place-order.ts
        </h2>

        <pre className="mt-8 rounded-2xl border border-emerald-500/20 bg-zinc-950 p-8 font-mono text-xl leading-relaxed overflow-hidden">
          <Kw>async function</Kw> <Fn>placeOrder</Fn><Punc>(</Punc>input<Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
          {"  "}<Dir>&quot;use workflow&quot;</Dir>{"\n"}
          {"  "}<Kw>const</Kw> compensations = <Punc>[]</Punc>{"\n"}
          {"\n"}
          {"  "}<Kw>await</Kw> <Fn>validateOrder</Fn><Punc>(</Punc>input<Punc>)</Punc>{"\n"}
          {"\n"}
          {"  "}<Kw>const</Kw> paymentId = <Kw>await</Kw> <Fn>chargePayment</Fn><Punc>(</Punc>input<Punc>)</Punc>{"\n"}
          {"  "}compensations.<Fn>push</Fn><Punc>(</Punc><Str>&quot;refund&quot;</Str><Punc>)</Punc>{"\n"}
          {"\n"}
          {"  "}<Kw>await</Kw> <Fn>notifyRestaurant</Fn><Punc>(</Punc>input<Punc>)</Punc>{"\n"}
          {"  "}<Kw>const</Kw> hook = <Fn>createHook</Fn><Punc>({"{"}</Punc> token <Punc>{"})"}</Punc>{"\n"}
          {"  "}<Kw>await</Kw> hook <Cmt>{"// suspends here"}</Cmt>{"\n"}
          {"\n"}
          {"  "}<Kw>const</Kw> driverId = <Kw>await</Kw> <Fn>assignDriver</Fn><Punc>(</Punc>input<Punc>)</Punc>{"\n"}
          {"  "}<Kw>await</Kw> <Fn>trackDelivery</Fn><Punc>(</Punc>input<Punc>)</Punc>{"\n"}
          {"  "}<Kw>await</Kw> <Fn>sendReceipt</Fn><Punc>(</Punc>input<Punc>)</Punc>{"\n"}
          <Punc>{"}"}</Punc>
        </pre>
      </div>

      {/* Right: mini timeline showing the demo mapping */}
      <div className="flex-1 max-w-md">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Current run
          </div>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight">
            Orchestrating...
          </h3>
          <div className="mt-2 font-mono text-base text-zinc-500">
            ord_a3x9k2m1
          </div>

          {/* mini horizontal timeline */}
          <div className="mt-8 flex items-center gap-0">
            {[
              { icon: "tri", style: "bg-white border-white text-black" },
              { icon: "tri", style: "bg-white border-white text-black" },
              { icon: "II", style: "border-amber-400 text-amber-300" },
              { icon: "4", style: "border-white/15 text-zinc-600" },
              { icon: "5", style: "border-white/15 text-zinc-600" },
              { icon: "6", style: "border-white/15 text-zinc-600" },
            ].map((n, i) => (
              <div key={i} className="flex items-center">
                {i > 0 && (
                  <div className={`h-[2px] w-4 ${i <= 2 ? "bg-white" : "bg-white/10"}`} />
                )}
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold ${n.style}`}>
                  {n.icon === "tri" ? (
                    <TriangleMark size={14} className="text-black" />
                  ) : (
                    n.icon
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3 text-base text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Waiting for restaurant to accept
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            How it maps
          </div>
          <div className="mt-4 flex flex-col gap-3 text-lg">
            <div className="flex items-center gap-3">
              <span className="font-mono text-emerald-400">workflow</span>
              <span className="text-zinc-600">&rarr;</span>
              <span className="text-zinc-300">orchestrates the saga</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-emerald-400">step</span>
              <span className="text-zinc-600">&rarr;</span>
              <span className="text-zinc-300">each circle in the timeline</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-amber-400">hook</span>
              <span className="text-zinc-600">&rarr;</span>
              <span className="text-zinc-300">the pause icon (II)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-fuchsia-400">compensation</span>
              <span className="text-zinc-600">&rarr;</span>
              <span className="text-zinc-300">the rollback pills</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
