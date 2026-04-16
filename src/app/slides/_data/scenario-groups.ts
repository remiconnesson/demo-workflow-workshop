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
    headline: "What happens when a payment retries?",
    marker: "chargePayment",
    markerLabel: "payment flaked",
  },
  "suspend": {
    headline: "What happens when you're waiting on a restaurant?",
    marker: "notifyRestaurant",
    markerLabel: "suspended on a hook",
  },
  "rollback": {
    headline: "What happens when a customer disputes?",
    marker: "sendReceipt",
    markerLabel: "post-delivery dispute",
  },
};
