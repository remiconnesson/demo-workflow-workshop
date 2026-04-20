export type OrderStepId =
  | "validateOrder"
  | "chargeCard"
  | "pingRestaurant"
  | "findDriver"
  | "trackDelivery"
  | "sendReceipts";

export type SlideStepState =
  | "pending"
  | "running"
  | "waiting"
  | "success"
  | "failed"
  | "skipped";

export type FailStep =
  | OrderStepId
  | "chargeCardRetryable"
  | null;

export type CompensationAction =
  | "refundPayment"
  | "cancelRestaurantOrder"
  | "releaseDriver";

export type DemoMode =
  | "standard"
  | "chargeCardUnhandledOnce"
  | "replayProbeBeforeFindDriver"
  | "prepWindowSleep"
  | "fanOutSendReceipts"
  | "adminSleepBeforeDriver"
  | "crashInjectable"
  | "naiveDoubleCharge"
  | "naiveCrashNoRecover"
  | "naivePoll"
  | "naiveAllOrNothing"
  | "disputeWindow";

export const ORDER_STEPS = [
  {
    id: "validateOrder",
    label: "Validate order",
    eventLabel: "Validate order",
    sub: "Schema & stock",
  },
  {
    id: "chargeCard",
    label: "Charge card",
    eventLabel: "Charge card",
    sub: "Stripe authorize",
  },
  {
    id: "pingRestaurant",
    label: "Ping restaurant",
    eventLabel: "Ping restaurant",
    sub: "Await accept",
  },
  {
    id: "findDriver",
    label: "Find driver",
    eventLabel: "Find driver",
    sub: "Dispatch",
  },
  {
    id: "trackDelivery",
    label: "Track delivery",
    eventLabel: "Track delivery",
    sub: "Live ETA",
  },
  {
    id: "sendReceipts",
    label: "Send receipts",
    eventLabel: "Send receipts",
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
  { value: "chargeCard", label: "Fail at chargeCard" },
  { value: "chargeCardRetryable", label: "Rate limit payment once" },
  { value: "pingRestaurant", label: "Fail at pingRestaurant" },
  { value: "findDriver", label: "Fail at findDriver" },
  { value: "trackDelivery", label: "Fail at trackDelivery" },
  { value: "sendReceipts", label: "Fail at sendReceipts" },
];

export const hookTokens = {
  restaurantAccept: (orderId: string) => `order:${orderId}:restaurant-accept`,
  driverAccept: (orderId: string) => `order:${orderId}:driver-accept`,
  delivered: (orderId: string) => `order:${orderId}:delivered`,
  adminCancel: (orderId: string) => `order:${orderId}:admin-cancel`,
  deliveryDispute: (orderId: string) => `order:${orderId}:delivery-dispute`,
} as const;
// NOTE: tokens are keyed only on orderId. Caller must ensure one
// active run per orderId or createHook() will throw hook_conflict.

export const RESUME_KIND_BY_STEP = {
  pingRestaurant: "restaurant-accept",
  findDriver: "driver-accept",
  trackDelivery: "delivered",
} as const satisfies Record<
  Extract<OrderStepId, "pingRestaurant" | "findDriver" | "trackDelivery">,
  "restaurant-accept" | "driver-accept" | "delivered"
>;
