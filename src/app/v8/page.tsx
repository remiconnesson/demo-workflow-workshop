"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Manrope } from "next/font/google";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const manrope = Manrope({ subsets: ["latin"], weight: ["500", "700", "800"] });

const MENU: OrderItem[] = [
  { id: "pho", name: "Beef Phở", price: 14, qty: 0 },
  { id: "banh", name: "Bánh Mì", price: 10, qty: 0 },
  { id: "spring", name: "Spring Rolls (4)", price: 8, qty: 0 },
  { id: "boba", name: "Taro Boba", price: 6, qty: 0 },
];

const STEPS = [
  { key: "validateOrder", label: "Order received" },
  { key: "chargePayment", label: "Payment confirmed" },
  { key: "notifyRestaurant", label: "Preparing your order" },
  { key: "assignDriver", label: "Courier assigned" },
  { key: "trackDelivery", label: "Heading your way" },
  { key: "sendReceipt", label: "Delivered" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "Happy path" },
  { value: "validateOrder", label: "Fail at validate" },
  { value: "chargePayment", label: "Fail at payment" },
  { value: "notifyRestaurant", label: "Fail at restaurant" },
  { value: "assignDriver", label: "Fail at driver" },
  { value: "sendReceipt", label: "Fail at receipt" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7.6-6.3-4.8-6.3 4.8 2.3-7.6-6-4.6h7.6z" />
    </svg>
  );
}

export default function UberEatsCloneDemo() {
  const [cart, setCart] = useState<OrderItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "pho" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("Ada Lovelace");
  const [address, setAddress] = useState("123 Cupcake Lane, SF");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const [view, setView] = useState<"restaurant" | "checkout" | "tracking">("restaurant");

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  const updateQty = (id: string, delta: number) =>
    setCart((c) =>
      c.map((i) =>
        i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i,
      ),
    );

  const reset = () => {
    abortRef.current?.abort();
    setEvents([]);
    setStepStatuses({});
    setResult(null);
    setCompensations([]);
    setCurrentOrderId(null);
  };

  const placeOrder = useCallback(async () => {
    reset();
    setView("tracking");
    setRunning(true);

    const orderId = `ord_${Date.now().toString(36)}`;
    setCurrentOrderId(orderId);

    const input: OrderInput = {
      orderId,
      customerName,
      address,
      items: cart.filter((i) => i.qty > 0),
      failAt,
      autoAck,
    };

    const startRes = await fetch("/api/orders/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const { runId } = (await startRes.json()) as { runId: string };

    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch(`/api/runs/${runId}/stream`, {
      signal: controller.signal,
    });
    if (!res.body) {
      setRunning(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as OrderEvent;
            applyEvent(event);
          } catch {
            // ignore non-json framing lines
          }
        }
      }
    } catch {
      // abort or stream ended
    } finally {
      setRunning(false);
    }
  }, [cart, customerName, address, failAt, autoAck]);

  const applyEvent = (event: OrderEvent) => {
    setEvents((ev) => [...ev, event]);
    switch (event.type) {
      case "step_running":
        setStepStatuses((s) => ({ ...s, [event.step]: "running" }));
        break;
      case "step_succeeded":
        setStepStatuses((s) => ({ ...s, [event.step]: "success" }));
        break;
      case "step_failed":
        setStepStatuses((s) => ({ ...s, [event.step]: "failed" }));
        break;
      case "step_skipped":
        setStepStatuses((s) => ({ ...s, [event.step]: "skipped" }));
        break;
      case "waiting_for_hook": {
        setStepStatuses((s) => ({ ...s, [event.step]: "waiting" }));
        if (autoAck) {
          const kind =
            event.step === "notifyRestaurant"
              ? ("restaurant-accept" as const)
              : event.step === "assignDriver"
                ? ("driver-accept" as const)
                : ("delivered" as const);
          setTimeout(() => {
            void resume(
              kind,
              kind === "delivered" ? {} : { accepted: true },
            );
          }, 800);
        }
        break;
      }
      case "hook_resolved":
        setStepStatuses((s) => ({ ...s, [event.step]: "success" }));
        break;
      case "compensated":
        setCompensations((c) => [...c, event.action]);
        break;
      case "done":
        setResult(event.status);
        break;
    }
  };

  const resume = async (
    kind: "restaurant-accept" | "driver-accept" | "delivered",
    payload: object = {},
  ) => {
    if (!currentOrderId) return;
    await fetch(`/api/orders/${currentOrderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  };

  const renderRestaurantView = () => (
    <div className="flex h-full flex-col overflow-y-auto bg-white pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md px-4 py-3 shadow-sm border-b border-zinc-100">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-[#05a357] uppercase tracking-wider">Delivery • Now</span>
            <span className="text-sm font-extrabold truncate max-w-[200px]">{address || "Home"}</span>
          </div>
          <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-lg">👤</div>
        </div>
      </div>

      {/* Hero */}
      <div className="relative h-56 w-full bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center">
        <span className="text-8xl drop-shadow-xl z-10">🍜</span>
      </div>

      <div className="px-4 py-5">
        <h1 className="text-[28px] font-extrabold tracking-tight text-black leading-tight">Phở Palace</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-zinc-700 font-medium">
          <span className="flex items-center gap-1 font-bold text-black"><StarIcon /> 4.8</span>
          <span className="text-zinc-400">(2,300+)</span>
          <span className="text-zinc-300">•</span>
          <span>25-40 min</span>
        </div>
        <div className="mt-1.5 text-sm text-zinc-500 font-medium">
          $1.99 delivery fee
        </div>
      </div>

      <div className="h-2 w-full bg-zinc-50 border-y border-zinc-100" />

      {/* Menu */}
      <div className="px-4 py-5">
        <h2 className="text-xl font-extrabold mb-5">Picked for you</h2>
        <div className="flex flex-col gap-0">
          {cart.map(item => (
            <div key={item.id} className="flex justify-between items-center border-b border-zinc-100 py-5 last:border-0">
              <div className="pr-4">
                <div className="font-bold text-[17px] text-black">{item.name}</div>
                <div className="mt-1 text-[15px] font-medium text-zinc-600">${item.price.toFixed(2)}</div>
              </div>
              <div className="relative flex-shrink-0">
                {item.qty > 0 ? (
                  <div className="flex items-center gap-4 bg-zinc-100 rounded-full px-3 py-1.5 border border-zinc-200">
                    <button onClick={() => updateQty(item.id, -1)} className="text-xl font-medium active:scale-95 transition-transform w-6 flex items-center justify-center">−</button>
                    <span className="font-bold text-[15px]">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="text-xl font-medium active:scale-95 transition-transform w-6 flex items-center justify-center">+</button>
                  </div>
                ) : (
                  <button onClick={() => updateQty(item.id, 1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 active:scale-95 transition-transform border border-zinc-200">
                    <span className="text-2xl font-medium text-black">+</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {totalItems > 0 && (
        <div className="absolute bottom-0 left-0 w-full p-4 bg-white border-t border-zinc-100 z-50 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button onClick={() => setView("checkout")} className="w-full bg-[#05a357] hover:bg-[#048c4a] text-white rounded-xl py-4 px-5 flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 font-bold text-[15px]">
              {totalItems}
            </div>
            <div className="font-bold text-[17px] tracking-wide">View cart</div>
            <div className="font-bold text-[17px]">${total.toFixed(2)}</div>
          </button>
        </div>
      )}
    </div>
  );

  const renderCheckoutView = () => (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center border-b border-zinc-100 px-4 py-4 sticky top-0 bg-white z-10">
        <button onClick={() => setView("restaurant")} className="h-10 w-10 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center active:scale-95 transition-transform">
          <span className="text-xl leading-none -mt-1">←</span>
        </button>
        <div className="flex-1 text-center font-extrabold text-[17px]">Checkout</div>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 pb-32">
        <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm">
          <div className="font-extrabold text-xl mb-5">Delivery details</div>
          
          <div className="mb-5">
            <label className="block text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider mb-2">Customer Name</label>
            <input 
              value={customerName} 
              onChange={e => setCustomerName(e.target.value)}
              className="w-full rounded-xl bg-zinc-100 px-4 py-3.5 font-bold text-[15px] outline-none focus:ring-2 focus:ring-[#05a357] transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider mb-2">Delivery Address</label>
            <input 
              value={address} 
              onChange={e => setAddress(e.target.value)}
              className="w-full rounded-xl bg-zinc-100 px-4 py-3.5 font-bold text-[15px] outline-none focus:ring-2 focus:ring-[#05a357] transition-all"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm">
          <div className="font-extrabold text-xl mb-5">Order summary</div>
          {cart.filter(i => i.qty > 0).map(item => (
            <div key={item.id} className="flex items-center justify-between mb-4 last:mb-0">
              <div className="flex items-center gap-3">
                <span className="border border-zinc-200 bg-zinc-50 rounded px-2 py-0.5 text-[15px] font-bold text-[#05a357]">{item.qty}</span>
                <span className="font-bold text-[15px]">{item.name}</span>
              </div>
              <span className="font-bold text-[15px]">${(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div className="mt-5 border-t border-zinc-100 pt-5 flex justify-between font-extrabold text-lg">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-4 bg-white border-t border-zinc-100 z-50 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button 
          onClick={placeOrder}
          disabled={running || total === 0}
          className="w-full bg-[#05a357] hover:bg-[#048c4a] text-white rounded-xl py-4 font-bold text-[17px] tracking-wide active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {running ? "Processing..." : "Place order"}
        </button>
      </div>
    </div>
  );

  const renderTrackingView = () => {
    let statusTitle = "Preparing your order";
    if (result === "completed") statusTitle = "Delivered";
    if (result === "rolled_back") statusTitle = "Order Cancelled";
    if (!result && stepStatuses["trackDelivery"] === "running") statusTitle = "Heading your way";
    if (!result && stepStatuses["assignDriver"] === "running") statusTitle = "Courier assigned";

    const showCourier = (stepStatuses["assignDriver"] === "success" || stepStatuses["trackDelivery"] === "running" || stepStatuses["trackDelivery"] === "success") && result !== "rolled_back";

    return (
      <div className="flex h-full flex-col bg-zinc-50 relative">
        {/* Fake Map Area */}
        <div className="relative h-[35%] w-full bg-[#e5e9ea] overflow-hidden">
          <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
            <path d="M 20,80 Q 40,20 60,60 T 80,20" fill="none" stroke="#05a357" strokeWidth="2" strokeDasharray="3 3" />
            <circle cx="20" cy="80" r="3" fill="#000" />
            <circle cx="80" cy="20" r="3" fill="#05a357" stroke="#fff" strokeWidth="1" />
          </svg>
          <button onClick={() => setView("restaurant")} className="absolute top-12 left-4 h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform z-20">
            <span className="text-xl font-bold leading-none -mt-1">×</span>
          </button>
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white rounded-full px-6 py-2.5 font-bold shadow-lg text-[15px] text-center whitespace-nowrap z-10 border border-zinc-100">
            {result === "completed" ? "Order Delivered" : result === "rolled_back" ? "Order Cancelled" : "Arriving in 20-30 min"}
          </div>
        </div>

        {/* Tracking Details Bottom Sheet */}
        <div className="flex-1 bg-white rounded-t-[2rem] -mt-8 z-10 p-6 flex flex-col shadow-[0_-10px_20px_rgba(0,0,0,0.08)] overflow-y-auto pb-8">
          <div className="w-12 h-1.5 bg-zinc-200 rounded-full mx-auto mb-6" />
          
          <div className="mb-8">
            <h2 className="text-[26px] font-extrabold tracking-tight leading-tight">{statusTitle}</h2>
            <p className="text-zinc-500 font-bold text-sm mt-1 uppercase tracking-wide">Order #{currentOrderId?.slice(0,8) || "..."}</p>
          </div>

          {/* Courier Mock */}
          {showCourier && (
            <div className="flex items-center gap-4 mb-8 p-4 rounded-2xl border border-zinc-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] bg-white">
              <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center text-2xl border border-zinc-200">🚗</div>
              <div className="flex-1">
                <div className="font-extrabold text-[17px]">Kevin</div>
                <div className="text-[13px] text-zinc-500 font-bold flex items-center gap-1 mt-0.5"><span className="text-black"><StarIcon /></span> 4.9 • Toyota Prius</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-lg">💬</div>
            </div>
          )}

          {/* Vertical Timeline */}
          <div className="flex flex-col">
            {STEPS.map((step, idx) => {
              const status = stepStatuses[step.key] ?? "pending";
              if (result === "rolled_back" && status === "pending") return null;

              const isSuccess = status === "success" || status === "skipped";
              const isRunning = status === "running" || status === "waiting";
              const isFailed = status === "failed";
              
              const nextStatus = STEPS[idx+1] ? (stepStatuses[STEPS[idx+1].key] ?? "pending") : "pending";
              const lineActive = isSuccess && (nextStatus !== "pending" && nextStatus !== "skipped" && nextStatus !== "failed" || result === "completed");

              return (
                <div key={step.key} className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <div className={`h-4 w-4 rounded-full flex-shrink-0 flex items-center justify-center z-10 ${
                      isSuccess ? "bg-[#05a357]" :
                      isRunning ? "bg-black border-[4px] border-zinc-200" :
                      isFailed ? "bg-red-500" :
                      "bg-zinc-200"
                    }`}>
                      {isSuccess && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`w-0.5 h-full min-h-[2.5rem] -mt-1 -mb-1 ${
                         lineActive ? "bg-[#05a357]" : "bg-zinc-200"
                      }`} />
                    )}
                  </div>
                  <div className={`-mt-1 pb-6 ${
                    status === "pending" ? "text-zinc-400" : 
                    isFailed ? "text-red-500" : 
                    "text-black"
                  }`}>
                    <div className="text-[17px] font-extrabold">{step.label}</div>
                    {status === "waiting" && <div className="text-[13px] text-amber-600 font-bold mt-0.5">Waiting for update...</div>}
                    {isFailed && <div className="text-[13px] text-red-500 font-bold mt-0.5">Something went wrong</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {result && (
            <button 
              onClick={() => {
                reset();
                setView("restaurant");
              }} 
              className="mt-6 w-full bg-zinc-100 hover:bg-zinc-200 text-black rounded-xl py-4 font-bold text-[17px] active:scale-95 transition-transform"
            >
              Start new order
            </button>
          )}
        </div>
      </div>
    );
  };

  function eventColor(type: OrderEvent["type"]): string {
    if (type === "step_failed" || type === "compensating") return "text-rose-400";
    if (type === "step_succeeded" || type === "hook_resolved" || type === "compensated") return "text-emerald-400";
    if (type === "waiting_for_hook") return "text-amber-300";
    if (type === "done") return "text-sky-300";
    return "text-zinc-400";
  }

  function summarizeEvent(e: OrderEvent): string {
    switch (e.type) {
      case "step_running":
      case "step_succeeded":
      case "step_failed":
      case "step_skipped":
        return `${e.label}${"detail" in e && e.detail ? ` — ${e.detail}` : ""}${"error" in e && e.error ? ` — ${e.error}` : ""}`;
      case "waiting_for_hook":
        return e.label;
      case "hook_resolved":
        return e.detail ?? e.token;
      case "compensation_pushed":
        return `${e.action} (for ${e.forStep})`;
      case "compensating":
      case "compensated":
        return e.action;
      case "log":
        return e.message;
      case "done":
        return `${e.status} — ${e.orderId}`;
      default:
        return "";
    }
  }

  return (
    <div className={`flex min-h-screen w-full bg-[#f3f3f3] p-4 lg:p-8 ${manrope.className}`}>
      <div className="mx-auto flex w-full max-w-7xl gap-8 flex-col lg:flex-row items-start">
        
        {/* Left: Mobile App Frame (Uber Eats Clone) */}
        <div className="relative flex-shrink-0 w-full max-w-[400px] bg-white overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.1)] rounded-[3rem] border-[12px] border-zinc-900 h-[850px] mx-auto lg:mx-0">
          {/* Dynamic Island Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[30px] bg-zinc-900 rounded-b-3xl z-[100]" />
          
          {/* App Views */}
          {view === "restaurant" && renderRestaurantView()}
          {view === "checkout" && renderCheckoutView()}
          {view === "tracking" && renderTrackingView()}
        </div>

        {/* Right: Dev Controls / Saga Dashboard */}
        <div className="flex-1 w-full flex flex-col gap-6 lg:max-w-3xl">
          
          {/* Header */}
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Saga Dev Tools</h1>
            <p className="text-zinc-500 font-medium mt-1">Control and monitor the distributed workflow</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6">
              <h2 className="text-[17px] font-extrabold mb-4 flex items-center gap-2">
                <span className="bg-zinc-100 text-zinc-600 rounded-lg p-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></span>
                Scenario Settings
              </h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-[13px] font-extrabold text-zinc-500 uppercase tracking-wider mb-2">Simulate Failure</label>
                  <select
                    value={failAt ?? "null"}
                    onChange={(e) => setFailAt(e.target.value === "null" ? null : e.target.value as FailStep)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[15px] font-bold outline-none focus:border-[#05a357] focus:ring-1 focus:ring-[#05a357] transition-all"
                  >
                    {FAIL_OPTIONS.map(opt => <option key={String(opt.value)} value={opt.value ?? "null"}>{opt.label}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 cursor-pointer hover:bg-zinc-50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={autoAck} 
                    onChange={e => setAutoAck(e.target.checked)} 
                    className="w-5 h-5 rounded border-zinc-300 text-[#05a357] focus:ring-[#05a357]"
                  />
                  <div className="flex flex-col">
                    <span className="font-extrabold text-[15px]">Auto-ack webhooks</span>
                    <span className="text-[13px] text-zinc-500 font-medium">Automatically resolve paused steps</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 flex flex-col">
              <h2 className="text-[17px] font-extrabold mb-4 flex items-center gap-2">
                <span className="bg-zinc-100 text-zinc-600 rounded-lg p-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></span>
                Manual Webhooks
              </h2>
              <div className="flex-1 flex flex-col justify-center gap-3">
                <div className="flex gap-2">
                  <button onClick={() => resume("restaurant-accept", { accepted: true })} className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-black px-3 py-2.5 rounded-xl text-[13px] font-extrabold active:scale-95 transition-transform">Accept Order</button>
                  <button onClick={() => resume("restaurant-accept", { accepted: false, reason: "86'd" })} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2.5 rounded-xl text-[13px] font-extrabold active:scale-95 transition-transform">Reject Order</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => resume("driver-accept", { accepted: true })} className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-black px-3 py-2.5 rounded-xl text-[13px] font-extrabold active:scale-95 transition-transform">Driver Accept</button>
                  <button onClick={() => resume("driver-accept", { accepted: false })} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2.5 rounded-xl text-[13px] font-extrabold active:scale-95 transition-transform">Driver Decline</button>
                </div>
                <button onClick={() => resume("delivered")} className="w-full bg-[#05a357]/10 hover:bg-[#05a357]/20 text-[#05a357] px-3 py-2.5 rounded-xl text-[13px] font-extrabold active:scale-95 transition-transform">Mark Delivered</button>
              </div>
            </div>
          </div>

          <div className="bg-zinc-950 rounded-3xl shadow-xl border border-zinc-800 p-6 flex-1 flex flex-col min-h-[350px] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-extrabold text-white flex items-center gap-2">
                <span className="bg-zinc-800 text-zinc-300 rounded-lg p-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg></span>
                Live Event Stream
              </h2>
              {running && <span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-[#05a357] opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-[#05a357]"></span></span>}
            </div>
            
            <div className="flex-1 overflow-auto font-mono text-[13px] text-zinc-300 bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
               {events.map((e, i) => (
                 <div key={i} className="mb-1.5 pb-1.5 border-b border-zinc-800/50 last:border-0 last:mb-0 last:pb-0">
                   <span className="text-zinc-500 mr-3">{new Date().toLocaleTimeString()}</span>
                   <span className={`font-semibold ${eventColor(e.type)}`}>{e.type}</span>{" "}
                   <span className="text-zinc-200">{summarizeEvent(e)}</span>
                 </div>
               ))}
               {events.length === 0 && <div className="text-zinc-600 flex items-center justify-center h-full">Waiting for events...</div>}
            </div>
          </div>
          
          {compensations.length > 0 && (
             <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-6 text-rose-900 shadow-sm">
               <h2 className="font-extrabold text-lg mb-3 flex items-center gap-2">
                 <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 Compensations Executed
               </h2>
               <div className="flex gap-2 flex-wrap">
                 {compensations.map((c, i) => (
                   <span key={i} className="bg-white border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm">
                     {c}
                   </span>
                 ))}
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
