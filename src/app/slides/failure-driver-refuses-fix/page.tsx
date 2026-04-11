import { FailureSlideLayout } from "../_components/failure-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

const WORKFLOW_FIX = {
  caption: "Push an undo for each step. FatalError pops them in reverse.",
  code: `const compensations = []

const paymentId = await chargePayment(order)
compensations.push(
  () => refundPayment(paymentId)
)

await notifyRestaurant(order)
compensations.push(
  () => cancelRestaurant(orderId)
)
// on FatalError → pop & call each`,
};

export default function FailureDriverRefusesFixSlide() {
  return (
    <FailureSlideLayout
      slide="failure-driver-refuses"
      eyebrow="09b · The refusal — the fix"
      headline="The only driver refused the job."
      marker="assignDriver"
      markerLabel="fatal → unwind"
      scenario={slideScenarios.saga}
      workflowFix={WORKFLOW_FIX}
    />
  );
}
