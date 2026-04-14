import { FixSlideLayout } from "../_components/fix-slide-layout";

export default function FailureDriverRefusesFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="09c · The refusal — workflow code"
      headline="The only driver refused the job."
      marker="assignDriver"
      markerLabel="fatal → unwind"
      workflowFix={{
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
      }}
    />
  );
}
