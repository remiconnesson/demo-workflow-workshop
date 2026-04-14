import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailurePrepWindowFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="08c · The wait — workflow code"
      {...failureGroups["failure-prep-window"]}
      workflowFix={{
        code: `// One line. The function suspends.
// You pay for nothing while it sleeps.
"use workflow"

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
