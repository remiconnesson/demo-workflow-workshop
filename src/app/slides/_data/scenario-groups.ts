import type { OrderStepId } from "@/lib/order-contract";

export type ScenarioGroupSlug =
  | "retry"
  | "suspend"
  | "rollback";

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
  "suspend": {
    headline: "Wait for Humans",
    marker: "notifyRestaurant",
    markerLabel: "suspended on a hook",
  },
  "rollback": {
    headline: "Dispute the Entire Order",
    marker: "sendReceipt",
    markerLabel: "post-delivery dispute",
  },
};
