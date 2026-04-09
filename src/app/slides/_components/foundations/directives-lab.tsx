"use client";

import { LiveOrderConceptLab } from "../live-order-concept-lab";
import { slideScenarios } from "../../_lib/slide-scenarios";

export function DirectivesLab() {
  return (
    <LiveOrderConceptLab
      slide="directives"
      scenario={slideScenarios.directives}
      showCompensations={false}
    />
  );
}
