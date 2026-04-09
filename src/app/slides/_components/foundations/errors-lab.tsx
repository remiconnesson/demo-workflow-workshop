"use client";

import { useState } from "react";
import { LiveOrderConceptLab } from "../live-order-concept-lab";
import { slideScenarios } from "../../_lib/slide-scenarios";
import type { OrderRunScenario } from "@/lib/order-run-client";

const MODES: Record<string, { label: string; scenario: OrderRunScenario }> = {
  uncaught: {
    label: "Uncaught Error",
    scenario: slideScenarios.errorsUnhandled,
  },
  fatal: {
    label: "FatalError",
    scenario: slideScenarios.errorsFatal,
  },
  retryable: {
    label: "RetryableError",
    scenario: slideScenarios.idempotency,
  },
};

export function ErrorsLab() {
  const [mode, setMode] = useState<keyof typeof MODES>("uncaught");
  const current = MODES[mode];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {Object.entries(MODES).map(([key, value]) => (
          <button
            key={key}
            onClick={() => {
              console.info("[slide-errors] mode", {
                mode: key,
                scenarioId: value.scenario.scenarioId,
              });
              setMode(key);
            }}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              mode === key
                ? "border-white text-white"
                : "border-white/10 text-zinc-500 hover:border-white/30 hover:text-zinc-300"
            }`}
          >
            {value.label}
          </button>
        ))}
      </div>
      <LiveOrderConceptLab
        key={mode}
        slide="errors"
        scenario={current.scenario}
        showCompensations={false}
        showChips={false}
        maxEvents={6}
      />
    </div>
  );
}
