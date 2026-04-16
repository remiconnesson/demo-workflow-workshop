import type { OrderStepId } from "@/lib/order-contract";

export type ScenarioGroupSlug =
  | "retry"
  | "slow-restaurant"
  | "dispute";

export type ScenarioGroup = {
  headline: string;
  marker: OrderStepId | OrderStepId[] | "span";
  markerLabel: string;
};

export const scenarioGroups: Record<ScenarioGroupSlug, ScenarioGroup> = {
  "retry": {
    headline: "Never Charge Twice",
    marker: "chargePayment",
    markerLabel: "payment flaked",
  },
  "slow-restaurant": {
    headline: "Wait for Humans",
    marker: "notifyRestaurant",
    markerLabel: "suspended on a hook",
  },
  "dispute": {
    headline: "Dispute the Entire Order",
    marker: "sendReceipt",
    markerLabel: "post-delivery dispute",
  },
};
