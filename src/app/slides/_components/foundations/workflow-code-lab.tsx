"use client";

import { useEffect } from "react";
import { OrderConceptLab } from "../order-concept-lab";
import { foundations } from "../../_data/foundations";

export function WorkflowCodeLab() {
  useEffect(() => {
    console.info("[slide-foundations] scenario", {
      slide: "workflow-code",
      scenarioId: "compensation-and-hooks",
    });
  }, []);

  return (
    <OrderConceptLab
      slide="workflow-code"
      scenarioId="compensation-and-hooks"
      frames={foundations.workflowCode}
    />
  );
}
