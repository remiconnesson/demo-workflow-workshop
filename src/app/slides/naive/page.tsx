import { Kw, Fn, Cmt, Punc } from "../_components/code-tokens";
import { NaiveLab } from "../_components/foundations/naive-lab";

export default function NaiveSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: code */}
      <div className="flex-1 max-w-2xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          The Problem
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Six awaits, zero durability
        </h2>

        <pre className="mt-10 rounded-2xl border border-white/10 bg-zinc-950 p-10 font-mono text-2xl leading-relaxed overflow-hidden">
          <Kw>export async function</Kw> <Fn>POST</Fn><Punc>(</Punc>req<Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
          {"  "}<Kw>const</Kw> order = <Kw>await</Kw> req.<Fn>json</Fn><Punc>()</Punc>{"\n"}
          {"\n"}
          {"  "}<Kw>await</Kw> <Fn>validateOrder</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
          {"  "}<Kw>await</Kw> <Fn>chargePayment</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
          {"  "}<Cmt>{"// ← server crashes here"}</Cmt>{"\n"}
          {"  "}<Kw>await</Kw> <Fn>notifyRestaurant</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
          {"  "}<Kw>await</Kw> <Fn>assignDriver</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
          {"  "}<Kw>await</Kw> <Fn>trackDelivery</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
          {"  "}<Kw>await</Kw> <Fn>sendReceipt</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
          <Punc>{"}"}</Punc>
        </pre>
      </div>

      {/* Right: interactive crash lab */}
      <div className="flex-1 max-w-xl">
        <NaiveLab />
      </div>
    </div>
  );
}
