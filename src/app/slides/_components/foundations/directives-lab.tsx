"use client";

import { useEffect } from "react";
import { OrderConceptLab } from "../order-concept-lab";
import { foundations } from "../../_data/foundations";

export function DirectivesLab() {
  useEffect(() => {
    console.info("[slide-foundations] scenario", {
      slide: "directives",
      scenarioId: "fragile-vs-durable",
    });
  }, []);

  return (
    <OrderConceptLab
      slide="directives"
      scenarioId="fragile-vs-durable"
      frames={foundations.directives}
    />
  );
}
