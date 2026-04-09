"use client";

import { LiveOrderConceptLab } from "../live-order-concept-lab";
import { slideScenarios } from "../../_lib/slide-scenarios";

export function WorkflowCodeLab() {
  return (
    <LiveOrderConceptLab
      slide="workflow-code"
      scenario={slideScenarios.workflowCode}
      showCompensations={false}
      showChips={false}
      maxEvents={6}
    />
  );
}
