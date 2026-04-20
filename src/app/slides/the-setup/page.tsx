import { CodeBlock } from "../_components/code-block";
import { PLACE_ORDER_SETUP } from "../_components/place-order-code";

export default async function TheSetupSlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center gap-10 px-20">
      <div>
        <h2 className="mt-3 text-6xl font-semibold tracking-tight">
          Wouldn&apos;t it be nice
          <span className="text-zinc-500"> if it was this simple?</span>
        </h2>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-950 p-10">
        <CodeBlock
          code={PLACE_ORDER_SETUP}
          lang="ts"
          textClass="text-[26px]"
          highlightLines={{
            3: "What if the input is **invalid** but the next step already ran?",
            5: "What if this **fails halfway**? The customer gets **charged twice**.",
            7: "What if the restaurant takes **10 minutes**? This function **times out**.",
            9: "What if **no drivers** are available? The order is stuck **forever**.",
            11: "What if the driver **cancels**? Who rolls back the restaurant?",
            13: "What if the server **crashes** here? The customer never gets receipts.",
          }}
        />
      </div>
    </div>
  );
}
