"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Bebas_Neue, Archivo } from "next/font/google";

const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400" });
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "700", "900"] });

type OrderItem = { id: string; name: string; price: number; qty: number };
type FailStep =
  | "validateOrder"
  | "chargeCard"
  | "pingRestaurant"
  | "findDriver"
  | "trackDelivery"
  | "sendReceipts"
  | null;

type OrderEvent =
  | { type: "step_running"; step: string; label: string }
  | { type: "step_succeeded"; step: string; label: string; detail?: string }
  | { type: "step_failed"; step: string; label: string; error: string }
  | { type: "step_skipped"; step: string; label: string }
  | { type: "waiting_for_hook"; step: string; token: string; label: string }
  | { type: "hook_resolved"; step: string; token: string; detail?: string }
  | {
      type: "compensation_pushed";
      action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver";
      forStep: string;
    }
  | {
      type: "compensating";
      action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver";
    }
  | {
      type: "compensated";
      action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver";
    }
  | { type: "log"; message: string }
  | {
      type: "done";
      status: "completed" | "rolled_back";
      orderId: string;
      compensationOrder: string[];
    };

const DONUTS = [
  { id: "d1", name: "THE DEPLOYER", desc: "CLASSIC TRIANGLE-CUT GLAZED", price: 3.5 },
  { id: "d2", name: "EDGE RUNTIME", desc: "SPICY JALAPEÑO GLAZE", price: 4.0 },
  { id: "d3", name: "COLD START", desc: "VANILLA FROST TRIANGLE", price: 3.0 },
  { id: "d4", name: "HOT MODULE", desc: "MOLTEN CHOCOLATE CORE", price: 4.5 },
  { id: "d5", name: "SERVERLESS SPRINKLE", desc: "RAINBOW TRIANGLES", price: 3.75 },
  { id: "d6", name: "HYDRATION HOLE", desc: "WATER-GLAZED RING CUT", price: 2.5 },
];

const STEPS = [
  "validateOrder",
  "chargeCard",
  "pingRestaurant",
  "findDriver",
  "trackDelivery",
  "sendReceipts",
];

const DonutShape = ({ index }: { index: number }) => {
  switch (index % 6) {
    case 0:
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12 drop-shadow-[2px_2px_0px_#0a0a0a]">
          <rect x="20" y="20" width="60" height="60" fill="#1d3557" />
          <polygon points="50,10 90,90 10,90" fill="#e63946" opacity="0.9" />
        </svg>
      );
    case 1:
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12 drop-shadow-[2px_2px_0px_#0a0a0a]">
          <circle cx="50" cy="50" r="40" fill="#0a0a0a" />
          <polygon points="50,10 90,90 10,90" fill="#f6bd60" opacity="0.9" />
          <circle cx="50" cy="65" r="8" fill="#e63946" />
          <circle cx="40" cy="50" r="6" fill="#e63946" />
          <circle cx="60" cy="50" r="5" fill="#e63946" />
        </svg>
      );
    case 2:
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12 drop-shadow-[2px_2px_0px_#0a0a0a]">
          <polygon points="10,10 90,10 50,90" fill="#1d3557" />
          <circle cx="50" cy="40" r="20" fill="#f5f0e8" opacity="0.9" />
        </svg>
      );
    case 3:
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12 drop-shadow-[2px_2px_0px_#0a0a0a]">
          <rect x="10" y="30" width="80" height="40" fill="#0a0a0a" />
          <polygon points="50,10 90,90 10,90" fill="#e63946" opacity="0.8" />
        </svg>
      );
    case 4:
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12 drop-shadow-[2px_2px_0px_#0a0a0a]">
          <polygon points="50,10 90,90 10,90" fill="#f6bd60" />
          <polygon points="50,20 70,60 30,60" fill="#1d3557" />
          <polygon points="50,40 60,60 40,60" fill="#e63946" />
        </svg>
      );
    case 5:
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12 drop-shadow-[2px_2px_0px_#0a0a0a]">
          <polygon points="10,90 90,90 50,10" fill="#1d3557" />
          <circle cx="50" cy="60" r="15" fill="#f5f0e8" />
        </svg>
      );
    default:
      return null;
  }
};

const generateOrderId = () => `bauhaus-${Math.random().toString(36).substring(2, 9)}`;

export default function BauhausTriangleDonuts() {
  const [orderId, setOrderId] = useState("");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [runId, setRunId] = useState("");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(false);
  const [ackedTokens, setAckedTokens] = useState<Set<string>>(new Set());
  const [compensations, setCompensations] = useState<string[]>([]);
  const [orderStatus, setOrderStatus] = useState<"idle" | "running" | "completed" | "rolled_back">("idle");

  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOrderId(generateOrderId());
  }, []);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  const stepStates = useMemo(() => {
    const states: Record<string, { name: string; label: string; status: string; token?: string }> = {};
    STEPS.forEach((s) => (states[s] = { name: s, label: s, status: "pending" }));

    events.forEach((ev) => {
      if (ev.type === "step_running") states[ev.step].status = "running";
      if (ev.type === "step_succeeded") states[ev.step].status = "success";
      if (ev.type === "step_failed") states[ev.step].status = "failed";
      if (ev.type === "step_skipped") states[ev.step].status = "skipped";
      if (ev.type === "waiting_for_hook") {
        states[ev.step].status = "waiting";
        states[ev.step].token = ev.token;
      }
      if (ev.type === "hook_resolved") states[ev.step].status = "success";
    });
    return states;
  }, [events]);

  useEffect(() => {
    if (!autoAck) return;
    const latest = events[events.length - 1];
    if (latest?.type === "waiting_for_hook") {
      if (ackedTokens.has(latest.token)) return;
      setAckedTokens((prev) => new Set(prev).add(latest.token));

      setTimeout(() => {
        const kind =
          latest.step === "pingRestaurant"
            ? "restaurant-accept"
            : latest.step === "findDriver"
            ? "driver-accept"
            : "delivered";

        fetch(`/api/orders/${orderId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, accepted: true }),
        }).catch(console.error);
      }, 800);
    }
  }, [events, autoAck, orderId, ackedTokens]);

  const addToCart = (donut: (typeof DONUTS)[0]) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === donut.id);
      if (ex) {
        return prev.map((i) => (i.id === donut.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...donut, qty: 1 }];
    });
  };

  const removeFromCart = (donut: (typeof DONUTS)[0]) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === donut.id);
      if (ex && ex.qty > 1) {
        return prev.map((i) => (i.id === donut.id ? { ...i, qty: i.qty - 1 } : i));
      }
      return prev.filter((i) => i.id !== donut.id);
    });
  };

  const handlePlaceOrder = async () => {
    setOrderStatus("running");
    setEvents([]);
    setCompensations([]);
    setAckedTokens(new Set());

    try {
      const res = await fetch("/api/orders/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          customerName: "WALTER GROPIUS",
          address: "BAUHAUS DESSAU, 1925",
          items: cart,
          failAt,
          autoAck,
        }),
      });
      const data = await res.json();
      setRunId(data.runId);

      const streamRes = await fetch(`/api/runs/${data.runId}/stream`);
      const reader = streamRes.body?.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.trim()) {
              const ev = JSON.parse(line) as OrderEvent;
              setEvents((prev) => [...prev, ev]);
              if (ev.type === "done") setOrderStatus(ev.status);
              if (ev.type === "compensated") {
                setCompensations((prev) => [...prev, ev.action]);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setOrderStatus("rolled_back");
    }
  };

  const resolveHook = async (kind: string, accepted: boolean) => {
    try {
      await fetch(`/api/orders/${orderId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, accepted }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (!orderId) return null;

  return (
    <div className="min-h-screen bg-[#f5f0e8] text-[#0a0a0a] p-8 lg:p-12 selection:bg-[#f6bd60] selection:text-[#0a0a0a] flex items-center justify-center font-sans overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 w-full max-w-[1400px] h-full items-center lg:items-stretch">
        
        {/* PHONE MOCKUP */}
        <div className="w-full max-w-[400px] h-[800px] border-[12px] border-[#0a0a0a] bg-[#f5f0e8] relative flex flex-col shrink-0 rounded-none shadow-[24px_24px_0px_#1d3557]">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[30px] border-r-[30px] border-t-[40px] border-l-transparent border-r-transparent border-t-[#e63946] z-30"></div>
          
          {/* Screen Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col relative z-10 pt-14 pb-20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {orderStatus === "idle" ? (
              <div className="flex flex-col px-6">
                <div className="flex gap-4 items-center mb-8">
                  {/* Logo */}
                  <div className="relative w-16 h-16 shrink-0">
                    <div className="absolute top-0 left-4 w-10 h-10 border-4 border-[#0a0a0a] bg-[#1d3557]"></div>
                    <div className="absolute top-4 left-0 w-12 h-12 rounded-full border-4 border-[#0a0a0a] bg-[#f6bd60]"></div>
                    <div className="absolute top-6 left-6 w-0 h-0 border-l-[16px] border-r-[16px] border-b-[28px] border-l-transparent border-r-transparent border-b-[#e63946] z-10 drop-shadow-[2px_2px_0px_#0a0a0a]"></div>
                  </div>
                  <h1 className={`${bebas.className} text-5xl leading-[0.85] text-[#1d3557]`}>
                    TRIANGLE<br />DONUTS
                  </h1>
                </div>

                <div className="flex flex-col gap-6">
                  {DONUTS.map((d, i) => {
                    const qty = cart.find((c) => c.id === d.id)?.qty || 0;
                    return (
                      <div key={d.id} className="border-4 border-[#0a0a0a] bg-white p-4 relative shadow-[6px_6px_0px_#f6bd60]">
                        <div className="absolute -top-4 -right-4 z-10">
                          <DonutShape index={i} />
                        </div>
                        <h2 className={`${bebas.className} text-3xl pr-8 leading-none mb-1`}>{d.name}</h2>
                        <p className={`${archivo.className} text-[10px] font-black uppercase text-[#e63946] tracking-widest`}>
                          {d.desc}
                        </p>
                        <div className="flex justify-between items-center mt-4">
                          <span className={`${bebas.className} text-2xl`}>${d.price.toFixed(2)}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => removeFromCart(d)}
                              className="w-8 h-8 bg-[#1d3557] text-[#f5f0e8] border-2 border-[#0a0a0a] font-black hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className={`${bebas.className} text-2xl w-4 text-center`}>{qty}</span>
                            <button
                              onClick={() => addToCart(d)}
                              className="w-8 h-8 bg-[#e63946] text-[#f5f0e8] border-2 border-[#0a0a0a] font-black hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {cart.length > 0 && (
                  <button
                    onClick={handlePlaceOrder}
                    className="mt-10 border-[6px] border-[#0a0a0a] bg-[#f6bd60] p-4 text-center cursor-pointer shadow-[8px_8px_0px_#0a0a0a] active:translate-y-1 active:translate-x-1 active:shadow-[4px_4px_0px_#0a0a0a] transition-all"
                  >
                    <span className={`${bebas.className} text-4xl`}>PLACE ORDER</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col px-6 h-full">
                <h1 className={`${bebas.className} text-6xl leading-[0.85] text-[#e63946] mb-8`}>
                  ORDER<br />STATUS
                </h1>

                <div className="flex-1 flex flex-col gap-6 relative pl-4 pb-12">
                  {/* Connecting Line */}
                  <div className="absolute left-[44px] top-4 bottom-6 w-2 bg-[#0a0a0a] z-0"></div>

                  {STEPS.map((step) => {
                    const state = stepStates[step];
                    const isActive = state.status === "running" || state.status === "waiting";
                    const isDone = state.status === "success";
                    const isFailed = state.status === "failed";

                    let bgColor = "#f5f0e8";
                    let icon = null;

                    if (state.status === "pending") {
                      bgColor = "#f5f0e8";
                      icon = <div className="w-4 h-4 bg-[#0a0a0a]" />;
                    } else if (state.status === "running" || state.status === "waiting") {
                      bgColor = "#f6bd60";
                      icon = (
                        <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[18px] border-l-transparent border-r-transparent border-b-[#0a0a0a] animate-pulse" />
                      );
                    } else if (state.status === "success") {
                      bgColor = "#1d3557";
                      icon = <div className="w-5 h-5 rounded-full bg-[#f5f0e8]" />;
                    } else if (state.status === "failed") {
                      bgColor = "#e63946";
                      icon = (
                        <div className="w-6 h-1.5 bg-[#0a0a0a] rotate-45 relative">
                          <div className="absolute w-6 h-1.5 bg-[#0a0a0a] -rotate-90"></div>
                        </div>
                      );
                    } else if (state.status === "skipped") {
                      bgColor = "#d1d5db";
                      icon = <div className="w-5 h-1.5 bg-[#0a0a0a]" />;
                    }

                    return (
                      <div key={step} className="flex items-center gap-6 z-10">
                        <div
                          className="w-14 h-14 shrink-0 border-[4px] border-[#0a0a0a] flex items-center justify-center drop-shadow-[4px_4px_0px_#0a0a0a]"
                          style={{ backgroundColor: bgColor }}
                        >
                          {icon}
                        </div>
                        <div className={`flex-1 border-[4px] border-[#0a0a0a] bg-white p-2 ${isActive ? 'shadow-[4px_4px_0px_#e63946]' : ''}`}>
                          <h3 className={`${bebas.className} text-2xl leading-none`}>{state.label}</h3>
                          <p className={`${archivo.className} text-[10px] font-black uppercase tracking-widest ${isFailed ? 'text-[#e63946]' : 'text-gray-500'}`}>
                            {state.status}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {orderStatus === "completed" && (
                  <div className="mt-4 bg-[#1d3557] text-[#f5f0e8] p-4 border-[6px] border-[#0a0a0a] text-center shadow-[6px_6px_0px_#0a0a0a]">
                    <span className={`${bebas.className} text-4xl`}>ORDER COMPLETE</span>
                  </div>
                )}
                {orderStatus === "rolled_back" && (
                  <div className="mt-4 bg-[#e63946] text-[#f5f0e8] p-4 border-[6px] border-[#0a0a0a] text-center shadow-[6px_6px_0px_#0a0a0a]">
                    <span className={`${bebas.className} text-4xl`}>ORDER FAILED</span>
                  </div>
                )}

                {(orderStatus === "completed" || orderStatus === "rolled_back") && (
                  <button
                    onClick={() => {
                      setOrderStatus("idle");
                      setCart([]);
                      setEvents([]);
                      setOrderId(generateOrderId());
                    }}
                    className="mt-6 border-[6px] border-[#0a0a0a] bg-white p-4 text-center w-full active:translate-y-1 active:translate-x-1 active:shadow-[0px_0px_0px_#0a0a0a] shadow-[6px_6px_0px_#0a0a0a] transition-all"
                  >
                    <span className={`${bebas.className} text-3xl`}>NEW ORDER</span>
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Home Button */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-12 bg-[#f5f0e8] rounded-full border-[6px] border-[#0a0a0a] z-20"></div>
        </div>

        {/* DASHBOARD */}
        <div className="flex-1 flex flex-col gap-8 h-[800px] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pr-4 relative">
          <div
            className="absolute inset-0 z-0 pointer-events-none opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(#0a0a0a 2px, transparent 2px), linear-gradient(90deg, #0a0a0a 2px, transparent 2px)",
              backgroundSize: "60px 60px",
            }}
          ></div>

          <div className="relative z-10 flex flex-col gap-8 h-full">
            <div className="flex justify-between items-end border-b-[12px] border-[#0a0a0a] pb-6">
              <h2 className={`${bebas.className} text-[100px] leading-[0.8] tracking-tighter text-[#1d3557]`}>
                DEV<br />PANEL
              </h2>
              <div className="text-right">
                <h3 className={`${bebas.className} text-4xl text-[#e63946]`}>ORDER ID</h3>
                <p className={`${archivo.className} text-2xl font-black uppercase tracking-widest bg-[#0a0a0a] text-white px-2 py-1 mt-1`}>
                  {orderId}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Settings */}
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className={`${bebas.className} text-4xl bg-[#0a0a0a] text-white px-3 py-1 inline-block w-fit mb-4`}>
                    SCENARIO / FAIL AT
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setFailAt(null)}
                      className={`border-[4px] border-[#0a0a0a] px-4 py-2 ${bebas.className} text-2xl transition-transform active:scale-95 ${
                        failAt === null
                          ? "bg-[#e63946] text-white shadow-[6px_6px_0px_#0a0a0a] -translate-y-1 -translate-x-1"
                          : "bg-white hover:bg-gray-100 shadow-[2px_2px_0px_#0a0a0a]"
                      }`}
                    >
                      NONE
                    </button>
                    {STEPS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setFailAt(s as FailStep)}
                        className={`border-[4px] border-[#0a0a0a] px-4 py-2 ${bebas.className} text-2xl transition-transform active:scale-95 ${
                          failAt === s
                            ? "bg-[#e63946] text-white shadow-[6px_6px_0px_#0a0a0a] -translate-y-1 -translate-x-1"
                            : "bg-white hover:bg-gray-100 shadow-[2px_2px_0px_#0a0a0a]"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-[6px] border-[#0a0a0a] bg-white p-6 shadow-[8px_8px_0px_#1d3557]">
                  <h3 className={`${bebas.className} text-4xl`}>AUTO ACKNOWLEDGE</h3>
                  <div
                    className={`w-20 h-10 border-[6px] border-[#0a0a0a] relative cursor-pointer ${
                      autoAck ? "bg-[#1d3557]" : "bg-gray-200"
                    }`}
                    onClick={() => setAutoAck(!autoAck)}
                  >
                    <div
                      className={`absolute -top-[6px] -bottom-[6px] w-8 bg-[#f6bd60] border-[6px] border-[#0a0a0a] transition-all shadow-[4px_4px_0px_#0a0a0a] ${
                        autoAck ? "left-10" : "-left-[6px]"
                      }`}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Hooks Controls */}
              <div className="flex flex-col gap-6">
                <h3 className={`${bebas.className} text-4xl bg-[#0a0a0a] text-white px-3 py-1 inline-block w-fit`}>
                  MANUAL HOOKS
                </h3>
                <div className="flex flex-col gap-4">
                  {stepStates.notifyRestaurant.status === "waiting" && (
                    <div className="flex gap-4">
                      <button
                        onClick={() => resolveHook("restaurant-accept", true)}
                        className={`flex-1 bg-[#1d3557] text-white border-[6px] border-[#0a0a0a] p-4 ${bebas.className} text-3xl shadow-[6px_6px_0px_#0a0a0a] active:translate-x-1 active:translate-y-1 active:shadow-[0px_0px_0px_#0a0a0a]`}
                      >
                        ACCEPT ORDER
                      </button>
                      <button
                        onClick={() => resolveHook("restaurant-accept", false)}
                        className={`flex-1 bg-[#e63946] text-white border-[6px] border-[#0a0a0a] p-4 ${bebas.className} text-3xl shadow-[6px_6px_0px_#0a0a0a] active:translate-x-1 active:translate-y-1 active:shadow-[0px_0px_0px_#0a0a0a]`}
                      >
                        REJECT ORDER
                      </button>
                    </div>
                  )}
                  {stepStates.assignDriver.status === "waiting" && (
                    <div className="flex gap-4">
                      <button
                        onClick={() => resolveHook("driver-accept", true)}
                        className={`flex-1 bg-[#1d3557] text-white border-[6px] border-[#0a0a0a] p-4 ${bebas.className} text-3xl shadow-[6px_6px_0px_#0a0a0a] active:translate-x-1 active:translate-y-1 active:shadow-[0px_0px_0px_#0a0a0a]`}
                      >
                        DRIVER ACCEPT
                      </button>
                      <button
                        onClick={() => resolveHook("driver-accept", false)}
                        className={`flex-1 bg-[#e63946] text-white border-[6px] border-[#0a0a0a] p-4 ${bebas.className} text-3xl shadow-[6px_6px_0px_#0a0a0a] active:translate-x-1 active:translate-y-1 active:shadow-[0px_0px_0px_#0a0a0a]`}
                      >
                        DRIVER REJECT
                      </button>
                    </div>
                  )}
                  {stepStates.trackDelivery.status === "waiting" && (
                    <div className="flex gap-4">
                      <button
                        onClick={() => resolveHook("delivered", true)}
                        className={`flex-1 bg-[#f6bd60] text-[#0a0a0a] border-[6px] border-[#0a0a0a] p-4 ${bebas.className} text-3xl shadow-[6px_6px_0px_#0a0a0a] active:translate-x-1 active:translate-y-1 active:shadow-[0px_0px_0px_#0a0a0a]`}
                      >
                        MARK DELIVERED
                      </button>
                    </div>
                  )}
                  {Object.values(stepStates).every((s) => s.status !== "waiting") && (
                    <div className="p-8 border-[6px] border-dashed border-gray-400 text-center font-bold text-gray-500 uppercase bg-white bg-opacity-50">
                      NO HOOKS WAITING
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 flex-1 min-h-[350px]">
              {/* Event Feed */}
              <div className="border-[8px] border-[#e63946] bg-white flex flex-col relative shadow-[12px_12px_0px_#e63946]">
                <div className="absolute -top-6 -left-2 bg-[#e63946] text-white px-4 py-2 border-[4px] border-[#0a0a0a]">
                  <h3 className={`${bebas.className} text-3xl`}>EVENT FEED</h3>
                </div>
                <div
                  ref={feedRef}
                  className="flex-1 p-6 pt-10 overflow-y-auto flex flex-col gap-2 font-mono text-[11px] uppercase font-black tracking-widest [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                  {events.length === 0 && <span className="text-gray-400">AWAITING EVENTS...</span>}
                  {events.map((ev, i) => (
                    <div key={i} className="border-b-[3px] border-gray-100 pb-2 mb-2 flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <span className="text-[#1d3557] bg-gray-100 px-1">{ev.type}</span>
                        {ev.type.startsWith("step_") && <span className="text-[#e63946]">{(ev as any).step}</span>}
                        {ev.type === "waiting_for_hook" && <span className="text-[#f6bd60] bg-[#0a0a0a] px-1">{(ev as any).step}</span>}
                      </div>
                      {ev.type === "log" && <span className="text-gray-500 pl-2 border-l-4 border-gray-200">{ev.message}</span>}
                      {(ev.type === "step_failed" || ev.type === "step_succeeded" || ev.type === "hook_resolved") && (
                        <span className="text-gray-600 truncate">
                          {ev.type === "step_failed" ? ev.error : ev.detail || ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Saga Viz & Compensations */}
              <div className="flex flex-col gap-8">
                <div className="border-[8px] border-[#1d3557] bg-white flex-1 relative p-8 flex flex-col justify-center shadow-[12px_12px_0px_#1d3557]">
                  <div className="absolute -top-6 -left-2 bg-[#1d3557] text-white px-4 py-2 border-[4px] border-[#0a0a0a]">
                    <h3 className={`${bebas.className} text-3xl`}>SAGA VIZ</h3>
                  </div>

                  <div className="flex flex-wrap gap-6 justify-center items-center">
                    {STEPS.map((step, i) => {
                      const state = stepStates[step];
                      return (
                        <div key={step} className="relative group cursor-default">
                          {state.status === "pending" && (
                            <div className="w-20 h-20 relative flex items-center justify-center">
                              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                                <rect x="10" y="10" width="80" height="80" fill="none" stroke="#0a0a0a" strokeWidth="6" strokeDasharray="10,10" />
                              </svg>
                              <span className={`${bebas.className} text-4xl text-gray-400 relative z-10`}>{i + 1}</span>
                            </div>
                          )}
                          {state.status === "running" && (
                            <div className="w-20 h-20 relative flex items-center justify-center animate-pulse">
                              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-[6px_6px_0px_#0a0a0a]">
                                <rect x="10" y="10" width="80" height="80" fill="#f6bd60" stroke="#0a0a0a" strokeWidth="6" />
                              </svg>
                              <span className={`${bebas.className} text-4xl text-[#0a0a0a] relative z-10`}>{i + 1}</span>
                            </div>
                          )}
                          {state.status === "waiting" && (
                            <div className="w-20 h-20 relative flex items-center justify-center animate-bounce">
                              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-[6px_6px_0px_#0a0a0a]">
                                <circle cx="50" cy="50" r="40" fill="#f6bd60" stroke="#0a0a0a" strokeWidth="6" />
                              </svg>
                              <span className={`${bebas.className} text-4xl text-[#0a0a0a] relative z-10`}>{i + 1}</span>
                            </div>
                          )}
                          {state.status === "success" && (
                            <div className="w-20 h-20 relative flex items-center justify-center">
                              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-[6px_6px_0px_#0a0a0a]">
                                <polygon points="50,15 90,85 10,85" fill="#1d3557" stroke="#0a0a0a" strokeWidth="6" />
                              </svg>
                              <span className={`${bebas.className} text-3xl text-white relative z-10 mt-4`}>{i + 1}</span>
                            </div>
                          )}
                          {state.status === "failed" && (
                            <div className="w-20 h-20 relative flex items-center justify-center">
                              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-[6px_6px_0px_#0a0a0a]">
                                <rect x="25" y="25" width="50" height="50" fill="#e63946" stroke="#0a0a0a" strokeWidth="6" transform="rotate(45 50 50)" />
                              </svg>
                              <span className={`${bebas.className} text-4xl text-white relative z-10`}>X</span>
                            </div>
                          )}
                          {state.status === "skipped" && (
                            <div className="w-20 h-20 relative flex items-center justify-center">
                              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-[6px_6px_0px_#0a0a0a]">
                                <rect x="10" y="10" width="80" height="80" fill="#d1d5db" stroke="#0a0a0a" strokeWidth="6" />
                              </svg>
                              <span className={`${bebas.className} text-4xl text-gray-600 relative z-10`}>-</span>
                            </div>
                          )}

                          <div className={`absolute top-[110%] left-1/2 -translate-x-1/2 bg-[#0a0a0a] text-white text-xs p-2 opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 ${archivo.className} uppercase font-black tracking-widest transition-opacity`}>
                            {step}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Compensations */}
                <div className="h-40 border-[8px] border-[#f6bd60] bg-white relative p-6 flex flex-col gap-3 overflow-y-auto shadow-[12px_12px_0px_#f6bd60]">
                  <div className="absolute -top-6 -left-2 bg-[#f6bd60] text-[#0a0a0a] px-4 py-2 border-[4px] border-[#0a0a0a]">
                    <h3 className={`${bebas.className} text-3xl`}>COMPENSATIONS</h3>
                  </div>
                  {compensations.length === 0 && (
                    <p className={`${archivo.className} text-gray-400 font-black uppercase text-xs mt-2 tracking-widest`}>
                      NO ROLLBACKS TRIGGERED.
                    </p>
                  )}
                  {compensations.map((c, i) => (
                    <div key={i} className="bg-[#0a0a0a] text-white px-3 py-2 font-black uppercase text-xs tracking-widest flex items-center gap-4 w-fit border-l-8 border-[#e63946]">
                      <span>UNDO: {c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
