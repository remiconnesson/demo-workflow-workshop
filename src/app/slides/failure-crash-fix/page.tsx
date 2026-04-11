import { FailureSlideLayout } from "../_components/failure-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

const WORKFLOW_FIX = {
  caption: "Same six awaits. Two directives. The runtime replays from the event log.",
  code: `"use workflow"

async function placeOrder(input) {
  const order   = await validateOrder(input)
  const payment = await chargePayment(order)
  await notifyRestaurant(order)
  const driver  = await assignDriver(order)
  await trackDelivery(order, driver)
  await sendReceipt(order, payment)
  // crash anywhere — it resumes
}`,
};

export default function FailureCrashFixSlide() {
  return (
    <FailureSlideLayout
      slide="failure-crash"
      eyebrow="04b · The crash — the fix"
      headline="It's 2am. The server just died."
      marker={["chargePayment", "notifyRestaurant"]}
      markerLabel="crash here"
      scenario={slideScenarios.failureCrash}
      allowCrash
      workflowFix={WORKFLOW_FIX}
    />
  );
}
