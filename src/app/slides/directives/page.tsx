import { Kw, Dir, Fn, Punc } from "../_components/code-tokens";
import { DirectivesLab } from "../_components/foundations/directives-lab";

export default function DirectivesSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-20">
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Directives
      </div>
      <h2 className="text-5xl font-semibold tracking-tight text-center">
        <span className="font-mono text-emerald-400">&quot;use workflow&quot;</span>
        {" + "}
        <span className="font-mono text-emerald-400">&quot;use step&quot;</span>
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-10 w-full max-w-6xl">
        {/* Left: naive (dimmed) */}
        <div className="relative">
          <div className="absolute -top-3 right-4 z-10 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1 text-sm font-semibold uppercase tracking-wider text-red-400">
            Fragile
          </div>
          <pre className="rounded-2xl border border-white/10 bg-zinc-950 p-10 font-mono text-xl leading-relaxed opacity-50">
            <Kw>export async function</Kw> <Fn>POST</Fn><Punc>(</Punc>req<Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
            {"  "}<Kw>const</Kw> order = <Kw>await</Kw> req.<Fn>json</Fn><Punc>()</Punc>{"\n"}
            {"  "}<Kw>await</Kw> <Fn>validateOrder</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
            {"  "}<Kw>await</Kw> <Fn>chargePayment</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
            {"  "}<Kw>await</Kw> <Fn>notifyRestaurant</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
            {"  "}<Kw>await</Kw> <Fn>assignDriver</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
            {"  "}<Kw>await</Kw> <Fn>trackDelivery</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
            {"  "}<Kw>await</Kw> <Fn>sendReceipt</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
            <Punc>{"}"}</Punc>
          </pre>
        </div>

        {/* Right: durable */}
        <div className="relative">
          <div className="absolute -top-3 right-4 z-10 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-sm font-semibold uppercase tracking-wider text-emerald-400">
            Durable
          </div>
          <pre className="rounded-2xl border border-emerald-500/20 bg-zinc-950 p-10 font-mono text-xl leading-relaxed">
            <Kw>async function</Kw> <Fn>placeOrder</Fn><Punc>(</Punc>input<Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
            {"  "}<Dir>&quot;use workflow&quot;</Dir>{"\n"}
            {"\n"}
            {"  "}<Kw>await</Kw> <Fn>validateOrder</Fn><Punc>(</Punc>input<Punc>)</Punc>{"\n"}
            {"  "}<Kw>await</Kw> <Fn>chargePayment</Fn><Punc>(</Punc>input<Punc>)</Punc>{"\n"}
            {"  "}<Kw>await</Kw> <Fn>notifyRestaurant</Fn><Punc>(</Punc>input<Punc>)</Punc>{"\n"}
            {"  "}<Kw>await</Kw> <Fn>assignDriver</Fn><Punc>(</Punc>input<Punc>)</Punc>{"\n"}
            {"  "}<Kw>await</Kw> <Fn>trackDelivery</Fn><Punc>(</Punc>input<Punc>)</Punc>{"\n"}
            {"  "}<Kw>await</Kw> <Fn>sendReceipt</Fn><Punc>(</Punc>input<Punc>)</Punc>{"\n"}
            <Punc>{"}"}</Punc>
          </pre>
        </div>
      </div>

      <div className="w-full max-w-6xl">
        <DirectivesLab />
      </div>
    </div>
  );
}
