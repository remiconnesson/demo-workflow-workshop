import type { OrderStepId } from "@/lib/order-contract";

export type FailureGroupSlug =
  | "failure-crash"
  | "failure-retry"
  | "failure-slow-restaurant"
  | "failure-ghost-restaurant"
  | "failure-prep-window"
  | "failure-driver-refuses"
  | "failure-admin-cancel"
  | "failure-live-updates"
  | "failure-fan-out";

export type FailureGroup = {
  headline: string;
  marker: OrderStepId | OrderStepId[] | "span";
  markerLabel: string;
};

export const failureGroups: Record<FailureGroupSlug, FailureGroup> = {
  "failure-crash": {
    headline: "Unexpected Failures Happen Anywhere",
    marker: ["chargePayment", "notifyRestaurant"],
    markerLabel: "crash here",
  },
  "failure-retry": {
    headline: "Accidentally Charging Twice",
    marker: "chargePayment",
    markerLabel: "payment flaked",
  },
  "failure-slow-restaurant": {
    headline: "Burning Money on setTimeout",
    marker: "notifyRestaurant",
    markerLabel: "suspended on a hook",
  },
  "failure-ghost-restaurant": {
    headline: "Sometimes No One Responds",
    marker: "notifyRestaurant",
    markerLabel: "timeout wins the race",
  },
  "failure-prep-window": {
    headline: "Scheduling Work Hours Into the Future",
    marker: ["chargePayment", "notifyRestaurant"],
    markerLabel: "20 min sleep",
  },
  "failure-driver-refuses": {
    headline: "Dispute the Order",
    marker: "sendReceipt",
    markerLabel: "post-delivery dispute",
  },
  "failure-admin-cancel": {
    headline: "The User Hits Cancel",
    marker: ["notifyRestaurant", "assignDriver"],
    markerLabel: "interrupt from outside",
  },
  "failure-live-updates": {
    headline: "Live Status Updates",
    marker: "span",
    markerLabel: "streamed end-to-end",
  },
  "failure-fan-out": {
    headline: "Simultaneously Email, SMS, and Push with Confidence",
    marker: "sendReceipt",
    markerLabel: "parallel, still durable",
  },
};
