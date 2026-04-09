import { Kw, Fn, Str, Cmt, Punc } from "../_components/code-tokens";

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
          {"  "}<Kw>await</Kw> <Fn>notifyRestaurant</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
          {"  "}<Cmt>{"// ← server crashes here"}</Cmt>{"\n"}
          {"  "}<Kw>await</Kw> <Fn>assignDriver</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
          {"  "}<Kw>await</Kw> <Fn>trackDelivery</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
          {"  "}<Kw>await</Kw> <Fn>sendReceipt</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
          <Punc>{"}"}</Punc>
        </pre>
      </div>

      {/* Right: pain point */}
      <div className="flex-1 max-w-xl">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-10">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
              Failure Scenario
            </span>
          </div>

          <h3 className="mt-6 text-3xl font-semibold tracking-tight">
            Server restarts between step 3 and 4
          </h3>

          <ul className="mt-8 flex flex-col gap-5 text-xl text-zinc-400">
            <li className="flex items-start gap-4">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500/60" />
              Payment charged, but restaurant never notified
            </li>
            <li className="flex items-start gap-4">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500/60" />
              No rollback. No record. No recovery.
            </li>
            <li className="flex items-start gap-4">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500/60" />
              Customer charged for food that never arrives
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
