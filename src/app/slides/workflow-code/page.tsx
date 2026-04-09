import { Kw, Dir, Fn, Cmt, Punc, Str } from "../_components/code-tokens";
import { WorkflowCodeLab } from "../_components/foundations/workflow-code-lab";

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

      {/* Right: interactive lab replaces static timeline */}
      <div className="flex-1 max-w-xl">
        <WorkflowCodeLab />
      </div>
    </div>
  );
}
