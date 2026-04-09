"use client";

import { LiveOrderConceptLab } from "../live-order-concept-lab";
import { slideScenarios } from "../../_lib/slide-scenarios";

export function IdempotencyLab() {
  return (
    <LiveOrderConceptLab
      slide="idempotency"
      scenario={slideScenarios.idempotency}
      highlightSteps={["chargePayment"]}
      showCompensations={false}
    />
  );
}
