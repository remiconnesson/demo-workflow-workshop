import { CodeBlock } from "../_components/code-block";
import { PLACE_ORDER_SETUP } from "../_components/place-order-code";


const SETUP_RISK_HIGHLIGHT_CLASS = [
  "[&_.code-hl]:transition-all",
  "[&_.code-hl]:duration-300",
  // Stable (retry): validateOrder, chargeCard, sendReceipts
  "[&_.code-line-3.code-hl]:!bg-sky-500/10",
  "[&_.code-line-3.code-hl]:!ring-1",
  "[&_.code-line-3.code-hl]:!ring-sky-400/30",
  "[&_.code-line-4.code-hl]:!bg-sky-500/10",
  "[&_.code-line-4.code-hl]:!ring-1",
  "[&_.code-line-4.code-hl]:!ring-sky-400/30",
  "[&_.code-line-8.code-hl]:!bg-sky-500/10",
  "[&_.code-line-8.code-hl]:!ring-1",
  "[&_.code-line-8.code-hl]:!ring-sky-400/30",
  // Suspendable: pingRestaurant, findDriver
  "[&_.code-line-5.code-hl]:!bg-amber-500/10",
  "[&_.code-line-5.code-hl]:!ring-1",
  "[&_.code-line-5.code-hl]:!ring-amber-400/30",
  "[&_.code-line-6.code-hl]:!bg-amber-500/10",
  "[&_.code-line-6.code-hl]:!ring-1",
  "[&_.code-line-6.code-hl]:!ring-amber-400/30",
  // Undoable (rollback): trackDelivery
  "[&_.code-line-7.code-hl]:!bg-fuchsia-500/10",
  "[&_.code-line-7.code-hl]:!ring-1",
  "[&_.code-line-7.code-hl]:!ring-fuchsia-400/30",
].join(" ");

export default async function TheSetupSlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1100px] flex-col justify-center gap-10 px-20">
      <header>
        <p className="font-mono text-lg font-semibold uppercase tracking-[0.24em] text-zinc-600">
          Starting point
        </p>
        <h2 className="mt-3 text-6xl font-semibold leading-[1.05] tracking-tight">
          Wouldn&apos;t it be nice
          <span className="text-zinc-500"> if it was this simple?</span>
        </h2>
      </header>

      <div className={`rounded-2xl border border-white/10 bg-zinc-950 p-10 ${SETUP_RISK_HIGHLIGHT_CLASS}`}>
          <CodeBlock
            code={PLACE_ORDER_SETUP}
            lang="ts"
            textClass="text-[26px]"
            highlightLines={{
              3: "What if the input is **invalid** but the next step already ran?",
              4: "What if this **fails halfway**? The customer gets **charged twice**.",
              5: "What if the restaurant takes **10 minutes**? This function **times out**.",
              6: "What if **no drivers** are available? The order is stuck **forever**.",
              7: "What if the customer **cancels**? Who rolls back the restaurant?",
              8: "What if the server **crashes** here? The customer never gets receipts.",
            }}
          />
      </div>
    </div>
  );
}
