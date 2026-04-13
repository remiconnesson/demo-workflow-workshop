import { FixSlideLayout } from "../_components/fix-slide-layout";

export default function FailurePrepWindowFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="08c · The wait — the fix"
      headline="Wait twenty minutes. Don't pay for it."
      marker={["chargePayment", "notifyRestaurant"]}
      markerLabel="20 min sleep"
      workflowFix={{
        caption: "One line. The function suspends. You pay for nothing while it sleeps.",
        code: `"use workflow"

async function placeOrder(input) {
  const order = await validateOrder(input)
  const payment = await chargePayment(order)

  await sleep("20m") // wait for prep window

  await notifyRestaurant(order)
  // ...
}`,
      }}
    />
  );
}
