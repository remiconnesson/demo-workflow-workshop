"use client";

import { useEffect } from "react";
import { OrderConceptLab } from "../order-concept-lab";
import { foundations } from "../../_data/foundations";

export function NaiveLab() {
  useEffect(() => {
    console.info("[slide-foundations] scenario", {
      slide: "naive",
      scenarioId: "crash-between-steps",
    });
  }, []);

  return (
    <OrderConceptLab
      slide="naive"
      scenarioId="crash-between-steps"
      frames={foundations.naive}
    />
  );
}
