import type { OrderStepId } from "@/lib/order-contract";

export type FailureGroupSlug =
  | "failure-retry"
  | "failure-slow-restaurant"
  | "failure-driver-refuses";

export type FailureGroup = {
  headline: string;
  marker: OrderStepId | OrderStepId[] | "span";
  markerLabel: string;
};

export const failureGroups: Record<FailureGroupSlug, FailureGroup> = {
  "failure-retry": {
    headline: "Accidentally Charging Twice",
    marker: "chargePayment",
    markerLabel: "payment flaked",
  },
  "failure-slow-restaurant": {
    headline: "Wait for Humans",
    marker: "notifyRestaurant",
    markerLabel: "suspended on a hook",
  },
  "failure-driver-refuses": {
    headline: "Dispute the Entire Order",
    marker: "sendReceipt",
    markerLabel: "post-delivery dispute",
  },
};
