"use client";

import { useEffect } from "react";
import { OrderConceptLab } from "../order-concept-lab";
import { foundations } from "../../_data/foundations";

export function ReplayLab() {
  useEffect(() => {
    console.info("[slide-foundations] scenario", {
      slide: "replay",
      scenarioId: "deterministic-replay",
    });
  }, []);

  return (
    <OrderConceptLab
      slide="replay"
      scenarioId="deterministic-replay"
      frames={foundations.replay}
    />
  );
}
