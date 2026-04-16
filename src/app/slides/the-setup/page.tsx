import { CodeBlock } from "../_components/code-block";

const PLACE_ORDER_CODE = `// placeOrder.ts — the starting point
async function placeOrder(input) {
  const order    = await validateOrder(input)
  const payment  = await chargePayment(order)
  const accepted = await notifyRestaurant(order)
  const driver   = await assignDriver(order)
  const delivery = await trackDelivery(order, driver)
  await sendReceipt(order, payment)
  return { ok: true }
}`;

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
          code={PLACE_ORDER_CODE}
          lang="ts"
          textClass="text-[26px]"
          highlightLines={{
            3: "What if the input is **invalid** but the next step already ran?",
            4: "What if this **fails halfway**? The customer gets **charged twice**.",
            5: "What if the restaurant takes **10 minutes**? This function **times out**.",
            6: "What if **no drivers** are available? The order is stuck **forever**.",
            7: "What if the driver **cancels**? Who rolls back the restaurant?",
            8: "What if the server **crashes** here? The customer never gets a receipt.",
          }}
        />
      </div>
    </div>
  );
}
