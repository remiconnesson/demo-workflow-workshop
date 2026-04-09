"use client";

import { LiveOrderConceptLab } from "../live-order-concept-lab";
import { slideScenarios } from "../../_lib/slide-scenarios";

export function ReplayLab() {
  return (
    <LiveOrderConceptLab
      slide="replay"
      scenario={slideScenarios.replay}
      showCompensations={false}
      showChips={false}
      maxEvents={8}
    />
  );
}
