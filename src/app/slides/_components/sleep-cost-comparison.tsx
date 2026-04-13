"use client";

import { useEffect, useRef, useState } from "react";
import type { OrderStepId, SlideStepState } from "@/lib/order-contract";

// ~$0.10/hr compute cost → $0.033 for 20 min for ONE order.
// Show "× 1,000 orders" to make the number sting: ~$33.
const COST_PER_HOUR = 0.1;
const SLEEP_MINUTES = 20;
const ORDER_MULTIPLIER = 1000;
const MAX_COST = (COST_PER_HOUR / 60) * SLEEP_MINUTES * ORDER_MULTIPLIER; // ~$33.33

function formatDollars(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Split cost counter: shows naive polling cost (dollars) ticking up vs
 * Workflow SDK frozen at $0.00 during a durable sleep.
 *
 * Always rendered in the DOM (CLS rule). Fades in when the
 * sleep phase is active, fades out when it ends.
 */
export function SleepCostComparison({
  stepState,
  running,
}: {
  stepState: Partial<Record<OrderStepId, SlideStepState>>;
  running: boolean;
}) {
  const [sleeping, setSleeping] = useState(false);
  const [finished, setFinished] = useState(false);
  const [naiveCost, setNaiveCost] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // Detect sleep phase: chargePayment succeeded, notifyRestaurant not yet running
  const chargeState = stepState.chargePayment;
  const notifyState = stepState.notifyRestaurant;
  const isSleeping =
    running &&
    chargeState === "success" &&
    (notifyState === "pending" || notifyState === undefined);

  useEffect(() => {
    if (isSleeping && !sleeping && !finished) {
      setSleeping(true);
      startTimeRef.current = performance.now();
      setNaiveCost(0);
    } else if (!isSleeping && sleeping) {
      setSleeping(false);
      setFinished(true);
      cancelAnimationFrame(rafRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSleeping]);

  // Reset when workflow resets
  useEffect(() => {
    if (!running && !isSleeping) {
      setSleeping(false);
      setFinished(false);
      setNaiveCost(0);
      cancelAnimationFrame(rafRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Animate: map ~3s real time → $33 over 1,000 orders
  useEffect(() => {
    if (!sleeping) return;
    const REAL_DURATION_MS = 3000;

    const tick = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const progress = Math.min(elapsed / REAL_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      setNaiveCost(eased * MAX_COST);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [sleeping]);

  const visible = sleeping || finished;

  return (
    <div
      className={`flex gap-6 transition-all duration-700 ${
        visible
          ? "opacity-100 max-h-[180px] mt-6"
          : "opacity-0 max-h-0 mt-0 overflow-hidden"
      }`}
    >
      {/* Naive approach */}
      <div className="flex-1 rounded-xl border border-red-500/30 bg-red-500/5 p-5">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
          Naive · polling loop
        </div>
        <div className="mt-1 text-lg text-zinc-500">
          Server idles 20 min × 1,000 orders
        </div>
        <div className="mt-3 font-mono text-5xl tabular-nums text-red-300">
          {formatDollars(naiveCost)}
        </div>
        <div className="mt-1 text-lg text-red-400/60">
          {sleeping ? "burning..." : "wasted compute"}
        </div>
      </div>

      {/* Workflow SDK */}
      <div className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Workflow SDK · sleep
        </div>
        <div className="mt-1 text-lg text-zinc-500">
          Server released, wakes on schedule
        </div>
        <div className="mt-3 font-mono text-5xl tabular-nums text-emerald-300">
          $0.00
        </div>
        <div className="mt-1 text-lg text-emerald-400/60">
          {sleeping ? "suspended" : "resumed"}
        </div>
      </div>
    </div>
  );
}
