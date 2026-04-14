import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureDriverRefusesFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="09c · The refusal — workflow code"
      {...failureGroups["failure-driver-refuses"]}
      workflowFix={{
        code: `// Push an undo for each step.
// FatalError pops them in reverse.
const compensations = []

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
