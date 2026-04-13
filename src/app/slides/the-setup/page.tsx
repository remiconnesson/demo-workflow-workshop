import { CodeBlock } from "../_components/code-block";

const PLACE_ORDER_CODE = `// placeOrder.ts — the version we're about to break
async function placeOrder(input) {
  const order    = await validateOrder(input)
  const payment  = await chargePayment(order)
  const accepted = await notifyRestaurant(order)
  const driver   = await assignDriver(order)
  const delivery = await trackDelivery(order, driver)
  await sendReceipt(order, payment)
  return { ok: true }
}`;

const FAILURE_MODES = [
  "Server dies mid-order",
  "Payment retries and double-charges",
  "Restaurant takes 10 minutes to respond",
  "Restaurant never responds",
  "20-minute prep window",
  "Driver refuses the job",
  "Support cancels a sleeping order",
  "Customer wants live updates",
  "Three notifications, one fails",
];

export default async function TheSetupSlide() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-10 px-20">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
          One bad day
        </div>
        <h2 className="mt-3 text-6xl font-semibold tracking-tight">
          Fifteen lines. Six awaits.
          <span className="text-zinc-500"> What could go wrong?</span>
        </h2>
      </div>

      <div className="grid grid-cols-[1.35fr_1fr] gap-10">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <CodeBlock code={PLACE_ORDER_CODE} lang="ts" textClass="text-2xl" />
        </div>

        <div className="flex flex-col justify-center rounded-2xl border border-red-500/30 bg-red-500/5 p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-red-300/80">
            What we&apos;re about to do to it
          </div>
          <ul className="mt-5 flex flex-col gap-3 font-mono text-xl leading-snug text-red-200/90">
            {FAILURE_MODES.map((mode, i) => (
              <li key={mode} className="flex gap-4">
                <span className="w-10 shrink-0 text-red-500/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{mode}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-2xl text-zinc-500">
        For each one — what do you do now?
      </p>
    </div>
  );
}
