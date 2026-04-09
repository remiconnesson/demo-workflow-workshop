"use client";

import { LiveOrderConceptLab } from "../live-order-concept-lab";
import { slideScenarios } from "../../_lib/slide-scenarios";

export function NaiveLab() {
  return (
    <LiveOrderConceptLab
      slide="naive"
      scenario={slideScenarios.naive}
      showCompensations={false}
      showChips={false}
      maxEvents={6}
    />
  );
}
