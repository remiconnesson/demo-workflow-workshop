import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureDriverRefusesFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="12c · The dispute — workflow code"
      {...failureGroups["failure-driver-refuses"]}
      workflowFix={{
        code: `// Every step already pushed its undo.
// Open a post-delivery dispute window.
const disputeHook = createHook({
  token: \`order:\${orderId}:dispute\`,
})
const verdict = await Promise.race([
  disputeHook,
  sleep("24h"),
])
if (verdict?.reason) {
  throw new FatalError(verdict.reason)
  // FatalError pops every undo in reverse
}`,
      }}
    />
  );
}
