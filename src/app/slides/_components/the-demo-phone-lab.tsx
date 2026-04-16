"use client";

import { useEffect, useMemo, useState } from "react";
import { Geist_Mono } from "next/font/google";
import {
  ClipboardCheck,
  CreditCard,
  ChefHat,
  Bike,
  MapPin,
  Receipt,
} from "lucide-react";
import { ORDER_STEPS, type OrderStepId, type SlideStepState } from "@/lib/order-contract";
import type { OrderItem } from "@/workflows/place-order";
import { useOrderRun, type OrderRunScenario } from "@/lib/order-run-client";
import { WorkflowMark } from "./workflow-mark";

const geistMono = Geist_Mono({ subsets: ["latin"] });

type MenuItem = OrderItem & { desc: string };

const MENU: MenuItem[] = [
  { id: "deployer", name: "The Deployer", desc: "Classic glazed · vanilla", price: 4.0, qty: 0 },
  { id: "edge", name: "Edge Runtime", desc: "Powdered sugar · fast", price: 4.5, qty: 0 },
  { id: "cold", name: "Cold Start", desc: "Frozen icing · crisp", price: 5.0, qty: 0 },
  { id: "hot", name: "Hot Module", desc: "Molten cinnamon core", price: 4.5, qty: 0 },
  { id: "isr", name: "ISR Glaze", desc: "Revalidates on taste", price: 5.5, qty: 0 },
];

const STEP_ICON: Record<OrderStepId, React.ReactNode> = {
  validateOrder: <ClipboardCheck size={28} strokeWidth={2.5} />,
  chargePayment: <CreditCard size={28} strokeWidth={2.5} />,
  notifyRestaurant: <ChefHat size={28} strokeWidth={2.5} />,
  assignDriver: <Bike size={28} strokeWidth={2.5} />,
  trackDelivery: <MapPin size={28} strokeWidth={2.5} />,
  sendReceipt: <Receipt size={28} strokeWidth={2.5} />,
};

const NODE_STYLE: Record<SlideStepState, string> = {
  pending: "border-white/15 text-zinc-600",
  running: "border-sky-400 text-sky-300",
  waiting: "border-amber-400 text-amber-300",
  success: "border-white bg-white text-black",
  failed: "border-red-500 bg-red-500/10 text-red-400",
  skipped: "border-zinc-800 bg-zinc-900 text-zinc-500",
};

const LINE_STYLE: Record<SlideStepState, string> = {
  pending: "bg-transparent",
  running: "bg-white/10",
  waiting: "bg-white/10",
  success: "bg-white",
  failed: "bg-white/10",
  skipped: "bg-transparent",
};

function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const dec = Math.floor((ms % 1000) / 100);
  return `${s}.${dec}s`;
}

export function TheDemoPhoneLab() {
  const [cart, setCart] = useState<MenuItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "deployer" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("Ada Lovelace");
  const [address, setAddress] = useState("440 N Wolfe Rd, Sunnyvale");

  const cartItems = cart.filter((i) => i.qty > 0);

  const scenario = useMemo<OrderRunScenario>(
    () => ({
      scenarioId: "the-demo-happy-path",
      title: "Triangle Donuts · happy path",
      subtitle: "All six steps complete on a real run.",
      input: {
        customerName,
        address,
        items: cartItems.map(({ id, name, price, qty }) => ({
          id,
          name,
          price,
          qty,
        })),
        failAt: null,
        autoAck: true,
      },
    }),
    [customerName, address, cartItems],
  );

  const run = useOrderRun("slides/the-demo", scenario);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt || run.doneStatus) return;
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(t);
  }, [startedAt, run.doneStatus]);

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const fee = cartItems.length > 0 ? 2.0 : 0;
  const total = subtotal + fee;

  const inc = (id: string) =>
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)));
  const dec = (id: string) =>
    setCart((c) =>
      c.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty - 1) } : i)),
    );

  const placeOrder = async () => {
    if (run.running) return;
    setElapsed(0);
    setStartedAt(Date.now());
    await run.start();
  };

  const resetOrder = () => {
    run.reset("user-reset");
    setStartedAt(null);
    setElapsed(0);
  };

  // `r` from slides layout → place order; `R` → reset
  useEffect(() => {
    const onRun = () => {
      if (!run.running && cartItems.length > 0) void placeOrder();
    };
    const onReset = () => resetOrder();
    window.addEventListener("slide:run", onRun);
    window.addEventListener("slide:reset", onReset);
    return () => {
      window.removeEventListener("slide:run", onRun);
      window.removeEventListener("slide:reset", onReset);
    };
  }, [run.running, cartItems.length]);

  const phoneView: "menu" | "tracking" = run.orderId ? "tracking" : "menu";
  const { stepState, compensations, doneStatus, running } = run;

  const successCount = Object.values(stepState).filter(
    (s) => s === "success",
  ).length;

  return (
    <div className="flex h-full w-full items-stretch gap-14 px-14 py-10">
      {/* ─────────────────── Phone ─────────────────── */}
      <div className="flex shrink-0 items-center justify-center">
        <div className="relative h-[min(980px,calc(100vh-120px))] w-[min(490px,calc((100vh-120px)*0.5))] overflow-hidden rounded-[48px] border-[12px] border-zinc-900 bg-white text-black shadow-[0_60px_120px_-20px_rgba(0,0,0,0.8)]">
          {/* dynamic island */}
          <div className="absolute left-1/2 top-3 z-20 h-8 w-40 -translate-x-1/2 rounded-full bg-black" />

          {/* status bar */}
          <div className="flex h-14 items-center justify-between px-8 pt-3 text-base font-medium">
            <span>9:41</span>
            <span className="flex items-center gap-2">
              <span>●●●●</span>
              <span>100%</span>
            </span>
          </div>

          {phoneView === "menu" && (
            <div className="flex h-[calc(100%-3.5rem)] flex-col">
              <div className="flex items-center gap-3 border-b border-zinc-100 px-8 py-5">
                <WorkflowMark size={22} className="text-black" />
                <span className="text-xl font-semibold tracking-tight">
                  Triangle Donuts
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-6">
                <h2 className="mb-1 text-3xl font-semibold tracking-tight">
                  Fresh today
                </h2>
                <p className="mb-5 text-base text-zinc-500">
                  Built at the edge. Delivered warm.
                </p>

                <div className="flex flex-col divide-y divide-zinc-100">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-4"
                    >
                      <div className="flex-1 pr-4">
                        <div className="text-lg font-semibold">{item.name}</div>
                        <div className="mt-0.5 text-sm text-zinc-500">
                          {item.desc}
                        </div>
                        <div className="mt-1 text-base font-medium text-zinc-900">
                          ${item.price.toFixed(2)}
                        </div>
                      </div>
                      {item.qty === 0 ? (
                        <button
                          onClick={() => inc(item.id)}
                          className="h-11 w-11 rounded-full border border-zinc-200 text-2xl font-light transition-colors hover:border-black hover:bg-black hover:text-white"
                          aria-label={`add ${item.name}`}
                        >
                          +
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 rounded-full border border-zinc-200 px-2 py-0.5">
                          <button
                            onClick={() => dec(item.id)}
                            className="h-8 w-8 text-xl font-light"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-base font-semibold">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => inc(item.id)}
                            className="h-8 w-8 text-xl font-light"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Name
                  </label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-black"
                  />
                  <label className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Deliver to
                  </label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-100 bg-white px-8 pb-8 pt-5">
                <div className="mb-2 flex items-baseline justify-between text-base">
                  <span className="text-zinc-500">
                    Subtotal ·{" "}
                    {cartItems.reduce((s, i) => s + i.qty, 0)} items
                  </span>
                  <span className="font-semibold">${subtotal.toFixed(2)}</span>
                </div>
                <div className="mb-4 flex items-baseline justify-between text-base">
                  <span className="text-zinc-500">Delivery</span>
                  <span className="font-semibold">${fee.toFixed(2)}</span>
                </div>
                <button
                  onClick={placeOrder}
                  disabled={cartItems.length === 0 || running}
                  className="flex w-full items-center justify-between rounded-2xl bg-black px-6 py-5 text-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <span>Place order</span>
                  <span>${total.toFixed(2)}</span>
                </button>
              </div>
            </div>
          )}

          {phoneView === "tracking" && (
            <div className="flex h-[calc(100%-3.5rem)] flex-col">
              <div className="flex items-center gap-3 border-b border-zinc-100 px-8 py-5">
                <WorkflowMark size={22} className="text-black" />
                <span className="text-xl font-semibold tracking-tight">
                  Your order
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="mb-1 text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
                  {doneStatus === "completed"
                    ? "Delivered"
                    : doneStatus === "rolled_back"
                      ? "Refunded"
                      : "In progress"}
                </div>
                <h2 className="mb-6 text-4xl font-semibold leading-none tracking-tight">
                  {doneStatus === "completed"
                    ? "Enjoy your donuts."
                    : doneStatus === "rolled_back"
                      ? "Something went wrong."
                      : "Heading your way"}
                </h2>

                <div className="flex flex-col gap-0">
                  {ORDER_STEPS.map((s, i) => {
                    const state: SlideStepState = stepState[s.id] ?? "pending";
                    const isLast = i === ORDER_STEPS.length - 1;
                    const dotBase =
                      "h-12 w-12 shrink-0 rounded-full border-2 flex items-center justify-center text-lg font-semibold";
                    const dot =
                      state === "success"
                        ? "border-black bg-black text-white"
                        : state === "running"
                          ? "border-black bg-white text-black"
                          : state === "waiting"
                            ? "border-amber-500 bg-amber-50 text-amber-600"
                            : state === "failed"
                              ? "border-red-500 bg-red-50 text-red-600"
                              : state === "skipped"
                                ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                                : "border-zinc-200 bg-white text-zinc-400";
                    const line =
                      state === "success" ? "bg-black" : "bg-zinc-200";
                    return (
                      <div key={s.id} className="flex items-start gap-5">
                        <div className="flex flex-col items-center">
                          <div className={`${dotBase} ${dot}`}>
                            {state === "success"
                              ? "✓"
                              : state === "failed"
                                ? "!"
                                : i + 1}
                          </div>
                          {!isLast && (
                            <div
                              className={`w-[2px] flex-1 min-h-[40px] ${line}`}
                            />
                          )}
                        </div>
                        <div className="flex-1 pb-6 pt-2">
                          <div className="text-lg font-semibold">{s.label}</div>
                          <div className="mt-0.5 text-sm text-zinc-500">
                            {s.sub}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-zinc-100 bg-white px-8 pb-8 pt-5">
                <button
                  onClick={resetOrder}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-6 py-4 text-lg font-semibold text-zinc-700 transition-colors hover:border-black hover:text-black"
                >
                  Place another order
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────── Right: V5 · question-only ─────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-12">
        <h2 className="text-7xl font-semibold leading-[0.95] tracking-tight">
          Ordering donuts
          <br />
          <span className="text-zinc-500">should be easy, right?</span>
        </h2>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-10">
          <div className="flex items-end justify-end gap-8">
            <div
              className={`${geistMono.className} text-6xl font-semibold ${
                doneStatus === "completed"
                  ? "text-white"
                  : doneStatus === "rolled_back"
                    ? "text-fuchsia-300"
                    : running
                      ? "text-sky-300"
                      : "text-zinc-500"
              }`}
            >
              {successCount}/{ORDER_STEPS.length}
            </div>
            <div
              className={`${geistMono.className} text-3xl ${compensations.length ? "text-fuchsia-400" : "text-zinc-700"}`}
            >
            </div>
          </div>
          <div className="mt-10">
            <div className="relative flex items-start gap-0">
              {ORDER_STEPS.map((s, i) => {
                const state: SlideStepState = stepState[s.id] ?? "pending";
                const isLast = i === ORDER_STEPS.length - 1;
                return (
                  <div
                    key={s.id}
                    className="flex min-w-0 flex-1 flex-col items-center"
                  >
                    <div className="relative flex w-full items-center justify-center">
                      <div
                        className={`relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 bg-black transition-colors ${NODE_STYLE[state]}`}
                      >
                        {STEP_ICON[s.id]}
                      </div>
                      {!isLast && (
                        <div
                          className={`absolute left-1/2 top-1/2 -z-0 h-[2px] w-full -translate-y-1/2 ${LINE_STYLE[state]}`}
                        />
                      )}
                    </div>
                    <div className="mt-4 text-center text-base font-semibold text-zinc-300">
                      {s.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
