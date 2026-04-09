export type OrderStepId =
  | "validateOrder"
  | "chargePayment"
  | "notifyRestaurant"
  | "assignDriver"
  | "trackDelivery"
  | "sendReceipt";

export type SlideStepState =
  | "pending"
  | "running"
  | "waiting"
  | "success"
  | "failed"
  | "skipped";

export type FailStep =
  | OrderStepId
  | "chargePaymentRetryable"
  | null;

export type CompensationAction =
  | "refundPayment"
  | "cancelRestaurantOrder"
  | "releaseDriver";

export const ORDER_STEPS = [
  {
    id: "validateOrder",
    label: "Validate order",
    eventLabel: "Validate order",
    sub: "Schema & stock",
  },
  {
    id: "chargePayment",
    label: "Charge payment",
    eventLabel: "Charge payment",
    sub: "Stripe authorize",
  },
  {
    id: "notifyRestaurant",
    label: "Notify bakery",
    eventLabel: "Notify restaurant",
    sub: "Await accept",
  },
  {
    id: "assignDriver",
    label: "Assign courier",
    eventLabel: "Assign driver",
    sub: "Dispatch",
  },
  {
    id: "trackDelivery",
    label: "Track delivery",
    eventLabel: "Track delivery",
    sub: "Live ETA",
  },
  {
    id: "sendReceipt",
    label: "Send receipt",
    eventLabel: "Send receipt",
    sub: "Email + SMS",
  },
] as const satisfies readonly {
  id: OrderStepId;
  label: string;
  eventLabel: string;
  sub: string;
}[];

export const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "No failure (happy path)" },
  { value: "validateOrder", label: "Fail at validateOrder" },
  { value: "chargePayment", label: "Fail at chargePayment" },
  { value: "chargePaymentRetryable", label: "Rate limit payment once" },
  { value: "notifyRestaurant", label: "Fail at notifyRestaurant" },
  { value: "assignDriver", label: "Fail at assignDriver" },
  { value: "trackDelivery", label: "Fail at trackDelivery" },
  { value: "sendReceipt", label: "Fail at sendReceipt" },
];

export const hookTokens = {
  restaurantAccept: (orderId: string) => `order:${orderId}:restaurant-accept`,
  driverAccept: (orderId: string) => `order:${orderId}:driver-accept`,
  delivered: (orderId: string) => `order:${orderId}:delivered`,
} as const;

export const RESUME_KIND_BY_STEP = {
  notifyRestaurant: "restaurant-accept",
  assignDriver: "driver-accept",
  trackDelivery: "delivered",
} as const satisfies Record<
  Extract<OrderStepId, "notifyRestaurant" | "assignDriver" | "trackDelivery">,
  "restaurant-accept" | "driver-accept" | "delivered"
>;
