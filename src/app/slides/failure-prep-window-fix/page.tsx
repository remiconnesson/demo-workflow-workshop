import { FailureSlideLayout } from "../_components/failure-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

const WORKFLOW_FIX = {
  caption: "One line. The function suspends. You pay for nothing while it sleeps.",
  code: `"use workflow"

async function placeOrder(input) {
  const order = await validateOrder(input)
  const payment = await chargePayment(order)

  await sleep("20m") // wait for prep window

  await notifyRestaurant(order)
  // ...
}`,
};

export default function FailurePrepWindowFixSlide() {
  return (
    <FailureSlideLayout
      slide="failure-prep-window"
      eyebrow="08b · The wait — the fix"
      headline="Wait twenty minutes. Don't pay for it."
      marker={["chargePayment", "notifyRestaurant"]}
      markerLabel="20 min sleep"
      scenario={slideScenarios.failurePrepWindow}
      workflowFix={WORKFLOW_FIX}
    />
  );
}
