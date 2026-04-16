"use client";

import { LiveOrderConceptLab } from "../_components/live-order-concept-lab";
import { slideScenarios } from "../_lib/slide-scenarios";

export function DisputeLab() {
  return (
    <LiveOrderConceptLab
      slide="rollback"
      scenario={{ ...slideScenarios.saga, subtitle: "" }}
      allowDispute
    />
  );
}

export const EYEBROW = "12a · Dispute";
export const TITLE = "Dispute the Entire Order";
