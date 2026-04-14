import { FixSlideLayout } from "../_components/fix-slide-layout";

export default function FailureCrashFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="04c · The crash — workflow code"
      headline="It's 2am. The server just died."
      marker={["chargePayment", "notifyRestaurant"]}
      markerLabel="crash here"
      workflowFix={{
        caption:
          "Same six awaits. Two directives. On restart, the runtime replays completed steps from the event log.",
        code: `async function placeOrder(input) {
  "use workflow"
  const order   = await validateOrder(input)
  const payment = await chargePayment(order)
  await notifyRestaurant(order)
  // on restart, completed steps are skipped
}

async function chargePayment(order) {
  "use step"
  return stripe.charges.create(...)
}`,
      }}
    />
  );
}
