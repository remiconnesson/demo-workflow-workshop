"use client";

import { useState } from "react";
import { OrderConceptLab } from "../order-concept-lab";
import { foundations } from "../../_data/foundations";

const MODES = {
  error: {
    label: "Uncaught Error",
    frames: foundations.errorsDefault,
  },
  fatal: {
    label: "FatalError",
    frames: foundations.errorsFatal,
  },
  retryable: {
    label: "RetryableError",
    frames: foundations.errorsRetryable,
  },
} as const;

export function ErrorsLab() {
  const [mode, setMode] = useState<keyof typeof MODES>("retryable");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {Object.entries(MODES).map(([key, value]) => (
          <button
            key={key}
            onClick={() => {
              console.info("[slide-errors] mode", { mode: key });
              setMode(key as keyof typeof MODES);
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
      <OrderConceptLab
        slide="errors"
        scenarioId={mode}
        frames={MODES[mode].frames}
      />
    </div>
  );
}
