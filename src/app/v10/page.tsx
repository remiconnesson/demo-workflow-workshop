"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

type MenuExt = OrderItem & { tag?: string; store?: string; emoji?: string };

const MENU: MenuExt[] = [
  { id: "pho", name: "Beef Phở", price: 14, qty: 0, tag: "Popular", store: "Pho 24", emoji: "🍜" },
  { id: "banh", name: "Bánh Mì", price: 10, qty: 0, tag: "New", store: "Banh Mi Co.", emoji: "🥖" },
  { id: "spring", name: "Spring Rolls (4)", price: 8, qty: 0, store: "Pho 24", emoji: "🥗" },
  { id: "boba", name: "Taro Boba", price: 6, qty: 0, tag: "20% off", store: "Boba Guys", emoji: "🧋" },
  { id: "padthai", name: "Pad Thai", price: 13, qty: 0, store: "Thai Basil", emoji: "🥡" },
  { id: "sushi", name: "Sushi Platter", price: 22, qty: 0, tag: "Popular", store: "Sushi Way", emoji: "🍣" },
  { id: "pizza", name: "Margherita", price: 18, qty: 0, store: "Luigi's", emoji: "🍕" },
  { id: "burger", name: "Smash Burger", price: 15, qty: 0, tag: "New", store: "Burger Hub", emoji: "🍔" },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "Order placed" },
  { key: "chargeCard", label: "Payment confirmed" },
  { key: "pingRestaurant", label: "Sending to store" },
  { key: "findDriver", label: "Finding a shopper" },
  { key: "trackDelivery", label: "Shopping & on the way" },
  { key: "sendReceipts", label: "Delivered" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "Happy path (Success)" },
  { value: "validateOrder", label: "Fail: Validation" },
  { value: "chargeCard", label: "Fail: Payment" },
  { value: "pingRestaurant", label: "Fail: Restaurant Hook" },
  { value: "findDriver", label: "Fail: Driver Hook" },
  { value: "sendReceipts", label: "Fail: Receipt" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

export default function InstacartClone() {
  const [cart, setCart] = useState<OrderItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "pho" ? 1 : 0 }))
  );
  const [customerName, setCustomerName] = useState("Ada Lovelace");
  const [address, setAddress] = useState("123 Cupcake Lane, San Francisco");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  
  const abortRef = useRef<AbortController | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const autoAckRef = useRef(autoAck);

  useEffect(() => {
    autoAckRef.current = autoAck;
  }, [autoAck]);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  const updateQty = (id: string, delta: number) =>
    setCart((c) =>
      c.map((i) =>
        i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i
      )
    );

  const reset = () => {
    abortRef.current?.abort();
    setEvents([]);
    setStepStatuses({});
    setResult(null);
    setCompensations([]);
    setCurrentOrderId(null);
    setRunning(false);
  };

  const placeOrder = useCallback(async () => {
    reset();
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

    try {
      const startRes = await fetch("/api/orders/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const { runId } = (await startRes.json()) as { runId: string };

      const controller = new AbortController();
      abortRef.current = controller;

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
            if (autoAckRef.current) {
              const kind =
                event.step === "pingRestaurant"
                  ? ("restaurant-accept" as const)
                  : event.step === "findDriver"
                  ? ("driver-accept" as const)
                  : ("delivered" as const);
              setTimeout(() => {
                void fetch(`/api/orders/${orderId}/resume`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ kind, ...(kind === "delivered" ? {} : { accepted: true }) }),
                });
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

  const resumeUI = async (
    kind: "restaurant-accept" | "driver-accept" | "delivered",
    payload: object = {}
  ) => {
    if (!currentOrderId) return;
    await fetch(`/api/orders/${currentOrderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  };

  const STORES = [
    { name: "Pho 24", emoji: "🍜" },
    { name: "Banh Mi Co.", emoji: "🥖" },
    { name: "Boba Guys", emoji: "🧋" },
    { name: "Thai Basil", emoji: "🥡" },
    { name: "Sushi Way", emoji: "🍣" },
    { name: "Luigi's", emoji: "🍕" },
    { name: "Burger Hub", emoji: "🍔" },
  ];

  const showTracking = running || result !== null || events.length > 0;

  return (
    <div className={`${font.className} min-h-screen bg-[#faf1e5] text-zinc-900 pb-12`}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm px-6 py-4 flex items-center justify-between border-b border-zinc-100">
        <div className="flex items-center gap-4">
          <div className="font-extrabold text-2xl tracking-tight text-[#43b02a] flex items-center gap-2 select-none">
            🥕 Instacart <span className="font-semibold text-zinc-700 text-lg hidden sm:inline">Ready Meals</span>
          </div>
          <div className="hidden lg:flex ml-8 relative">
            <input
              type="text"
              placeholder="Search for food, restaurants, or items"
              className="w-96 rounded-full bg-zinc-100 px-4 py-2.5 pl-10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#43b02a] transition-all"
            />
            <span className="absolute left-3.5 top-2.5 text-zinc-400 text-sm">🔍</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="font-bold text-sm hover:bg-zinc-100 px-4 py-2 rounded-full transition-colors hidden sm:block">
            Log in
          </button>
          <button className="bg-[#43b02a] text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-[#3b9c25] transition-colors flex items-center gap-2 shadow-sm">
            🛒 {totalItems}
          </button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 pt-8 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10 items-start">
        {/* Left Content */}
        <div className="space-y-10">
          {/* Hero Banner */}
          <div className="w-full bg-[#fdf5e6] border border-[#f3e1c6] rounded-[2rem] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between overflow-hidden relative shadow-sm">
            <div className="relative z-10 max-w-lg">
              <span className="bg-[#ff6b00] text-white text-[11px] font-extrabold uppercase tracking-widest py-1.5 px-3 rounded-full mb-4 inline-block shadow-sm">
                Free Delivery
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold text-zinc-900 mb-4 leading-tight tracking-tight">
                Fresh meals, <br />delivered fast.
              </h1>
              <p className="text-zinc-600 font-bold mb-0 text-lg">
                The best local restaurants to your door in minutes.
              </p>
            </div>
            <div className="hidden md:flex gap-4 relative z-10 mt-6 md:mt-0">
              <div className="w-24 h-24 bg-white rounded-full shadow-lg border-[6px] border-[#faf1e5] flex items-center justify-center text-5xl transform -rotate-12">
                🥗
              </div>
              <div className="w-32 h-32 bg-white rounded-full shadow-lg border-[6px] border-[#faf1e5] flex items-center justify-center text-6xl transform translate-y-8 z-10">
                🍜
              </div>
              <div className="w-20 h-20 bg-white rounded-full shadow-lg border-[6px] border-[#faf1e5] flex items-center justify-center text-4xl transform rotate-12 translate-y-4">
                🥑
              </div>
            </div>
          </div>

          {/* Shop by Store */}
          <section>
            <h2 className="text-2xl font-extrabold mb-5 tracking-tight text-zinc-800 select-none">Shop by store</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {STORES.map((s, idx) => (
                <div key={s.name} className="flex flex-col items-center gap-2 min-w-[5.5rem] cursor-pointer group">
                  <div className="w-[4.5rem] h-[4.5rem] rounded-full bg-white shadow-sm border border-zinc-100 flex items-center justify-center text-3xl group-hover:ring-4 ring-[#43b02a]/20 transition-all duration-300">
                    {s.emoji}
                  </div>
                  <span className="text-xs font-extrabold text-center text-zinc-700">{s.name}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Fresh & Ready Meals */}
          <section>
            <h2 className="text-2xl font-extrabold mb-5 tracking-tight text-zinc-800 select-none">Fresh & Ready Meals</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {MENU.map((item) => {
                const qty = cart.find((c) => c.id === item.id)?.qty || 0;
                return (
                  <div
                    key={item.id}
                    className="relative flex flex-col bg-white rounded-[1.5rem] p-4 shadow-sm border border-zinc-100 hover:shadow-md transition-shadow group select-none"
                  >
                    {item.tag && (
                      <span
                        className={`absolute top-0 left-0 rounded-tl-[1.5rem] rounded-br-[1rem] px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-sm z-10 ${
                          item.tag.includes("off") ? "bg-[#ff6b00]" : "bg-indigo-500"
                        }`}
                      >
                        {item.tag}
                      </span>
                    )}
                    <div className="h-32 w-full bg-zinc-50/50 rounded-2xl mb-4 flex items-center justify-center text-6xl group-hover:scale-110 transition-transform duration-300">
                      {item.emoji}
                    </div>
                    <div className="flex flex-col mt-auto gap-3">
                      <div>
                        <div className="font-extrabold text-lg text-zinc-900">${item.price.toFixed(2)}</div>
                        <div className="text-sm font-extrabold text-zinc-700 leading-tight truncate">
                          {item.name}
                        </div>
                        <div className="text-xs font-bold text-zinc-400 mt-0.5 truncate">{item.store}</div>
                      </div>
                      <div className="h-9">
                        {qty > 0 ? (
                          <div className="flex items-center justify-between bg-[#43b02a] text-white rounded-full px-1 py-1 shadow-sm h-full">
                            <button
                              onClick={() => updateQty(item.id, -1)}
                              className="w-7 h-7 flex items-center justify-center font-bold text-lg hover:bg-white/20 rounded-full transition-colors active:scale-95"
                            >
                              −
                            </button>
                            <span className="font-extrabold text-sm">{qty}</span>
                            <button
                              onClick={() => updateQty(item.id, 1)}
                              className="w-7 h-7 flex items-center justify-center font-bold text-lg hover:bg-white/20 rounded-full transition-colors active:scale-95"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => updateQty(item.id, 1)}
                            className="w-full h-full flex items-center justify-center gap-1.5 bg-white border-2 border-zinc-200 shadow-sm text-[#43b02a] font-extrabold text-sm rounded-full hover:border-[#43b02a] transition-colors active:scale-95"
                          >
                            <span className="text-lg leading-none mb-0.5">+</span> Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:sticky lg:top-[5.5rem]">
          {!showTracking ? (
            <div className="bg-white rounded-[2rem] shadow-sm border border-zinc-100 p-6 md:p-8">
              <h2 className="text-2xl font-extrabold mb-6 tracking-tight">Checkout</h2>

              <div className="space-y-3 mb-6">
                <div>
                  <label className="block text-[11px] font-extrabold text-zinc-500 mb-1.5 ml-1 uppercase tracking-widest">
                    Deliver to
                  </label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer Name"
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3 text-sm font-extrabold focus:ring-2 focus:ring-[#43b02a] focus:border-[#43b02a] outline-none transition-all mb-2"
                  />
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Delivery Address"
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3 text-sm font-extrabold focus:ring-2 focus:ring-[#43b02a] focus:border-[#43b02a] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="bg-amber-50/50 rounded-2xl p-5 mb-6 border border-amber-100/60 shadow-sm">
                <div className="text-[11px] font-extrabold text-amber-800 mb-3 uppercase tracking-widest flex items-center gap-1.5 select-none">
                  <span className="text-sm">⚙️</span> Demo Configuration
                </div>
                <div className="mb-4">
                  <label className="block text-[10px] font-extrabold text-amber-700/70 mb-1.5 ml-1 uppercase tracking-widest">
                    Saga Scenario
                  </label>
                  <select
                    value={failAt ?? "null"}
                    onChange={(e) =>
                      setFailAt(e.target.value === "null" ? null : (e.target.value as FailStep))
                    }
                    className="w-full bg-white border border-amber-200/60 text-amber-900 rounded-xl px-3 py-2.5 text-sm font-extrabold focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer shadow-sm"
                  >
                    {FAIL_OPTIONS.map((opt) => (
                      <option key={String(opt.value)} value={opt.value ?? "null"}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2.5 text-sm font-extrabold text-amber-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoAck}
                    onChange={(e) => setAutoAck(e.target.checked)}
                    className="w-4 h-4 rounded border-amber-300 text-[#43b02a] focus:ring-[#43b02a]"
                  />
                  Auto-ack hooks
                </label>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-zinc-500">Subtotal</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-zinc-500">Delivery Fee</span>
                  <span>$3.99</span>
                </div>
                <div className="flex justify-between text-xl font-extrabold mt-4 pt-4 border-t border-zinc-100">
                  <span>Total</span>
                  <span>${(total > 0 ? total + 3.99 : 0).toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={placeOrder}
                disabled={running || total === 0}
                className="w-full bg-[#43b02a] text-white font-extrabold text-lg py-4 rounded-[1.25rem] hover:bg-[#3b9c25] transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-sm shadow-[#43b02a]/20 flex items-center justify-center gap-2"
              >
                {running ? <span className="animate-pulse">Processing...</span> : <span>Place order</span>}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] shadow-sm border border-zinc-100 p-6 md:p-8 flex flex-col max-h-[calc(100vh-6rem)]">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h2 className="text-2xl font-extrabold tracking-tight">Order Status</h2>
                <button
                  onClick={reset}
                  className="text-xs font-extrabold text-zinc-500 hover:text-zinc-900 bg-zinc-100 px-3.5 py-1.5 rounded-full transition-colors active:scale-95 select-none"
                >
                  Close
                </button>
              </div>

              <div className="overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex-1 pb-2">
                {/* Map/Tracker placeholder */}
                <div className="w-full h-36 bg-zinc-50 rounded-[1.5rem] mb-6 relative overflow-hidden flex items-center justify-center border border-zinc-100 select-none">
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: "radial-gradient(#43b02a 1px, transparent 1px)",
                      backgroundSize: "16px 16px",
                    }}
                  ></div>
                  <div className="absolute inset-x-0 top-1/2 h-1.5 bg-zinc-200 -translate-y-1/2"></div>
                  <div
                    className={`absolute left-0 top-1/2 h-1.5 bg-[#43b02a] -translate-y-1/2 transition-all duration-1000 ${
                      result === "completed" ? "w-full" : "w-1/2"
                    }`}
                  ></div>

                  <div className="absolute bg-white px-3 py-1.5 rounded-xl shadow-sm text-[11px] font-extrabold flex items-center gap-2 border border-zinc-100 z-10 tracking-wide uppercase text-zinc-800">
                    <span className="relative flex h-2.5 w-2.5">
                      {running && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#43b02a] opacity-75"></span>
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                          result === "rolled_back" ? "bg-red-500" : "bg-[#43b02a]"
                        }`}
                      ></span>
                    </span>
                    {result === "completed"
                      ? "Delivered"
                      : result === "rolled_back"
                      ? "Cancelled"
                      : "In Progress"}
                  </div>
                </div>

                {result && (
                  <div
                    className={`mb-6 p-4 rounded-xl font-extrabold text-sm text-center shadow-sm border select-none ${
                      result === "completed"
                        ? "bg-[#43b02a]/10 text-[#43b02a] border-[#43b02a]/20"
                        : "bg-red-50 text-red-600 border-red-100"
                    }`}
                  >
                    {result === "completed" ? "🎉 Order successfully completed!" : "❌ Order rolled back."}
                  </div>
                )}

                {/* Progress List */}
                <div className="relative pl-5 border-l-2 border-zinc-100 ml-4 space-y-6 mb-8 select-none">
                  {STEPS.map((step) => {
                    const status = stepStatuses[step.key] ?? "pending";
                    const isPast = status === "success" || status === "skipped";
                    const isRunning = status === "running" || status === "waiting";
                    const isFailed = status === "failed";

                    let dotColor = "bg-zinc-100 border-zinc-200";
                    if (isPast) dotColor = "bg-[#43b02a] border-[#43b02a]";
                    else if (isRunning) dotColor = "bg-white border-[#43b02a] border-[3px]";
                    else if (isFailed) dotColor = "bg-red-500 border-red-500";

                    return (
                      <div key={step.key} className="relative">
                        {/* Node */}
                        <div
                          className={`absolute -left-[29px] top-0.5 w-5 h-5 rounded-full border-2 ${dotColor} flex items-center justify-center transition-colors shadow-sm`}
                        >
                          {isPast && <span className="text-white text-[10px] font-extrabold">✓</span>}
                          {isFailed && <span className="text-white text-[10px] font-extrabold">✕</span>}
                        </div>
                        <div
                          className={`font-extrabold text-sm transition-colors ${
                            isRunning
                              ? "text-zinc-900"
                              : isPast
                              ? "text-zinc-800"
                              : isFailed
                              ? "text-red-600"
                              : "text-zinc-400"
                          }`}
                        >
                          {step.label}
                        </div>
                        {isRunning && status === "waiting" && (
                          <div className="text-xs text-amber-600 font-extrabold mt-1 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                            Awaiting response...
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {compensations.length > 0 && (
                  <div className="mb-6 p-4 rounded-xl bg-red-50/80 border border-red-100/50 shadow-sm select-none">
                    <div className="text-[10px] font-extrabold text-red-600 mb-3 uppercase tracking-widest">
                      Compensations (Rollbacks)
                    </div>
                    <div className="space-y-2">
                      {compensations.map((c, i) => (
                        <div key={i} className="text-xs font-bold text-red-700 flex items-center gap-2">
                          <span className="text-red-400 text-lg leading-none">⤺</span> {c}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hook Controls */}
                <div className="bg-zinc-50/80 rounded-2xl p-4 border border-zinc-100 mb-6 shadow-sm">
                  <h3 className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest mb-3 select-none">
                    Manual Webhooks
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => resumeUI("restaurant-accept", { accepted: true })}
                      className="bg-white border border-[#43b02a]/60 text-[#43b02a] font-extrabold text-[11px] py-2.5 rounded-xl hover:bg-[#43b02a]/5 transition-all shadow-sm active:scale-95"
                    >
                      Store: Accept
                    </button>
                    <button
                      onClick={() => resumeUI("restaurant-accept", { accepted: false, reason: "Busy" })}
                      className="bg-white border border-red-500/60 text-red-600 font-extrabold text-[11px] py-2.5 rounded-xl hover:bg-red-50 transition-all shadow-sm active:scale-95"
                    >
                      Store: Reject
                    </button>
                    <button
                      onClick={() => resumeUI("driver-accept", { accepted: true })}
                      className="bg-white border border-[#43b02a]/60 text-[#43b02a] font-extrabold text-[11px] py-2.5 rounded-xl hover:bg-[#43b02a]/5 transition-all shadow-sm active:scale-95"
                    >
                      Driver: Accept
                    </button>
                    <button
                      onClick={() => resumeUI("driver-accept", { accepted: false })}
                      className="bg-white border border-red-500/60 text-red-600 font-extrabold text-[11px] py-2.5 rounded-xl hover:bg-red-50 transition-all shadow-sm active:scale-95"
                    >
                      Driver: Reject
                    </button>
                    <button
                      onClick={() => resumeUI("delivered")}
                      className="col-span-2 bg-[#43b02a] text-white font-extrabold text-xs py-3 rounded-xl hover:bg-[#3b9c25] transition-all shadow-sm active:scale-[0.98] mt-1"
                    >
                      Mark Delivered
                    </button>
                  </div>
                </div>

                {/* Event Feed */}
                <div className="bg-[#111] rounded-[1.5rem] p-4 min-h-[12rem] max-h-[16rem] overflow-y-auto font-mono text-[10px] sm:text-xs shadow-inner leading-relaxed">
                  {events.length === 0 ? (
                    <div className="text-zinc-500 flex items-center justify-center h-full font-bold select-none">
                      Connecting stream...
                    </div>
                  ) : (
                    events.map((e, i) => (
                      <div key={i} className="mb-2 last:mb-0 break-words">
                        <span className="text-zinc-500/80 mr-2 select-none">
                          {new Date().toLocaleTimeString(undefined, {
                            hour12: false,
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                        <span className={`${eventColor(e.type)} font-bold`}>{e.type}</span>{" "}
                        <span className="text-zinc-300 font-medium">{summarizeEvent(e)}</span>
                      </div>
                    ))
                  )}
                  <div ref={eventsEndRef} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function eventColor(type: OrderEvent["type"]): string {
  if (type === "step_failed" || type === "compensating") return "text-rose-400";
  if (type === "step_succeeded" || type === "hook_resolved" || type === "compensated")
    return "text-emerald-400";
  if (type === "waiting_for_hook") return "text-amber-400";
  if (type === "done") return "text-sky-400";
  return "text-zinc-400";
}

function summarizeEvent(e: OrderEvent): string {
  switch (e.type) {
    case "step_running":
    case "step_succeeded":
    case "step_failed":
    case "step_skipped":
      return `${e.label}${"detail" in e && e.detail ? ` — ${e.detail}` : ""}${
        "error" in e && e.error ? ` — ${e.error}` : ""
      }`;
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
