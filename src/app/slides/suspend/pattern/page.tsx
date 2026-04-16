import { PatternSlideLayout } from "../../_components/pattern-slide-layout";
import { scenarioGroups } from "../../_data/scenario-groups";

const { marker, markerLabel } = scenarioGroups["suspend"];

export default function SuspendPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="06d · The slow restaurant — concept / pattern"
      patternName="Human-in-the-Loop"
      description={<><code className="font-mono text-zinc-200">Suspend</code> a workflow and <code className="font-mono text-zinc-200">resume</code> it later with external data. A <code className="font-mono text-zinc-200">hook</code> generates a unique <code className="font-mono text-zinc-200">token</code> for any external system to send data back in.</>}
      apiPrimitive={["createHook()", "createWebhook()"]}
      docSection="Cookbook · Agent Patterns"
      docUrl="workflow-sdk.dev/docs/cookbook/agent-patterns/human-in-the-loop"
      marker={marker}
      markerLabel={markerLabel}
      realWorldExamples={[
        "KYC identity verification",
        "Manager approvals",
        "Third-party webhook callbacks",
        "Multi-day onboarding sequences",
        "Legal document signing",
      ]}
    />
  );
}
