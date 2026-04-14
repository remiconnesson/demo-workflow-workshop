import { CodeBlock } from "../_components/code-block";
import { NaivePanel } from "../_components/naive-panel";

const WORKFLOW_CODE = `"use workflow"

async function placeOrder(input) {
  const order    = await validateOrder(input)
  const payment  = await chargePayment(order)
  const accepted = await notifyRestaurant(order)
  const driver   = await assignDriver(order)
  const delivery = await trackDelivery(order, driver)
  await sendReceipt(order, payment)
  return { ok: true }
}`;

const ANNOTATIONS = [
  { line: "validateOrder", note: "replay-safe step" },
  { line: "chargePayment", note: "stable stepId -> idempotent retry" },
  { line: "notifyRestaurant", note: "hook pause + timeout race in workflow code" },
  { line: "assignDriver", note: "FatalError -> rollback path" },
  { line: "trackDelivery", note: "stream updates written from steps" },
  { line: "sendReceipt", note: "parallel fan-out with Promise.allSettled" },
];

export default async function TheRevealSlide() {
  return (
    <div className="flex h-full w-full flex-col gap-6 px-14 py-8">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
          13 · The reveal
        </div>
        <h2 className="mt-2 text-[44px] font-semibold leading-tight tracking-tight">
          Same product. Much less machinery.
          <span className="text-zinc-500"> One of these is yours to maintain.</span>
        </h2>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-6 overflow-hidden">
        {/* Naive horror — reuse NaivePanel's final (slide 12) accumulation */}
        <div className="min-h-0">
          <NaivePanel slide="failure-fan-out" />
        </div>

        {/* Workflow version — big mono block */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-emerald-400/30 bg-zinc-950 p-8">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
              What we wrote
            </div>
            <div className="flex items-center gap-3 font-mono text-xl">
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-1 text-emerald-200">
                1 file
              </span>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-1 text-emerald-200">
                15 lines
              </span>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-white/5 bg-black/60 p-6">
            <CodeBlock code={WORKFLOW_CODE} lang="ts" textClass="text-[26px]" />
          </div>

          <div className="mt-5 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto font-mono text-base">
            {ANNOTATIONS.map((a) => (
              <div key={a.line} className="flex items-baseline gap-4">
                <span className="w-44 shrink-0 text-emerald-300">{a.line}</span>
                <span className="text-zinc-400">{a.note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center">
        <span className="font-mono text-3xl text-zinc-100">
          Two directives unlock replay. Hooks, sleep, retries, and saga logic stay in your code.
        </span>
      </div>
    </div>
  );
}
