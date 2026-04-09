"use client";

import { useEffect } from "react";
import { OrderConceptLab } from "../order-concept-lab";
import { foundations } from "../../_data/foundations";

export function IdempotencyLab() {
  useEffect(() => {
    console.info("[slide-foundations] scenario", {
      slide: "idempotency",
      scenarioId: "stable-step-id",
    });
  }, []);

  return (
    <OrderConceptLab
      slide="idempotency"
      scenarioId="stable-step-id"
      frames={foundations.idempotency}
    />
  );
}
