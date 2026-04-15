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
async function placeOrder(input) {
  "use workflow"
  const order = await validateOrder(input)
  const payment = await chargePayment(order)

  // production: "20m" — compressed to "3s" for stage
  await sleep("20m")

  await notifyRestaurant(order)
  // ...
}

// Verify the sleep landed in the trace:
//   npx workflow inspect sleeps -r <runId>`,
      }}
    />
  );
}
