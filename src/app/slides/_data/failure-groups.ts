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
    headline: "The money moved. The order didn't.",
    marker: ["chargePayment", "notifyRestaurant"],
    markerLabel: "crash here",
  },
  "failure-retry": {
    headline: "Your customer just got charged twice.",
    marker: "chargePayment",
    markerLabel: "payment flaked",
  },
  "failure-slow-restaurant": {
    headline: "Ten minutes of silence. Your server is still running.",
    marker: "notifyRestaurant",
    markerLabel: "suspended on a hook",
  },
  "failure-ghost-restaurant": {
    headline: "The restaurant never answers.",
    marker: "notifyRestaurant",
    markerLabel: "timeout wins the race",
  },
  "failure-prep-window": {
    headline: "Nothing happens for twenty minutes. Something has to remember.",
    marker: ["chargePayment", "notifyRestaurant"],
    markerLabel: "20 min sleep",
  },
  "failure-driver-refuses": {
    headline: "Charged the card. Started cooking. No one's coming.",
    marker: "assignDriver",
    markerLabel: "fatal → unwind",
  },
  "failure-admin-cancel": {
    headline: "The workflow is asleep. The customer is not.",
    marker: ["notifyRestaurant", "assignDriver"],
    markerLabel: "interrupt from outside",
  },
  "failure-live-updates": {
    headline: "Your backend knows. Your frontend doesn't.",
    marker: "span",
    markerLabel: "streamed end-to-end",
  },
  "failure-fan-out": {
    headline: "Fan out three. Get back two.",
    marker: "sendReceipt",
    markerLabel: "parallel, still durable",
  },
};
