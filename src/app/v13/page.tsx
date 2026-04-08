"use client";

import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Inter } from "next/font/google";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const MENU_DATA: (OrderItem & { desc: string; img: string; category: string })[] = [
  {
    id: "smash",
    name: "Double Smash Burger",
    price: 12.5,
    qty: 0,
    category: "Burgers",
    desc: "Two aged beef patties, American cheese, caramelized onions, house sauce on a toasted brioche bun.",
    img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=200&h=200&q=80",
  },
  {
    id: "chicken",
    name: "Spicy Fried Chicken",
    price: 11.0,
    qty: 0,
    category: "Burgers",
    desc: "Crispy buttermilk fried chicken, spicy mayo, pickles, lettuce.",
    img: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=200&h=200&q=80",
  },
  {
    id: "fries",
    name: "Rosemary Fries",
    price: 4.5,
    qty: 0,
    category: "Sides",
    desc: "Skin-on fries tossed with sea salt and fresh rosemary.",
    img: "https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=200&h=200&q=80",
  },
  {
    id: "shake",
    name: "Vanilla Shake",
    price: 5.5,
    qty: 0,
    category: "Drinks",
    desc: "Thick hand-spun vanilla bean milkshake.",
    img: "https://images.unsplash.com/photo-1572490122747-3968b75bb699?auto=format&fit=crop&w=200&h=200&q=80",
  },
];

const STEPS: { key: string; label: string; desc: string }[] = [
  { key: "validateOrder", label: "Validate order", desc: "Checking availability" },
  { key: "chargePayment", label: "Charge payment", desc: "Processing payment" },
  { key: "notifyRestaurant", label: "Notify restaurant", desc: "Sending to kitchen" },
  { key: "assignDriver", label: "Assign driver", desc: "Looking for a rider" },
  { key: "trackDelivery", label: "Track delivery", desc: "Rider on the way" },
  { key: "sendReceipt", label: "Send receipt", desc: "Emailed to you" },
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

// --- Icons ---
const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#00ccbc" className="inline mr-1">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1 opacity-60">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);
const BikeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1 opacity-60">
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="18.5" cy="17.5" r="3.5" />
    <path d="M15 6a1 1 0 100-2 1 1 0 000 2zm-3 11.5V14l-3-3 4-3 2 3h2" />
  </svg>
);

export default function DeliverooDemo() {
  const [cart, setCart] = useState<typeof MENU_DATA>(
    MENU_DATA.map((m) => ({ ...m, qty: m.id === "smash" ? 1 : 0 }))
  );
  const [customerName, setCustomerName] = useState("Ada Lovelace");
  const [address, setAddress] = useState("123 Cupcake Lane, San Francisco");
  
  // Demo State
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  
  // Saga State
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  
  // UI State
  const [view, setView] = useState<"menu" | "checkout" | "tracking">("menu");

  const abortRef = useRef<AbortController | null>(null);

  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const deliveryFee = 2.49;
  const serviceFee = 1.99;
  const total = subtotal + deliveryFee + serviceFee;

  const updateQty = (id: string, delta: number) =>
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)));

  const reset = () => {
    abortRef.current?.abort();
    setEvents([]);
    setStepStatuses({});
    setResult(null);
    setCompensations([]);
    setCurrentOrderId(null);
    setRunning(false);
    setView("menu");
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
      items: cart.filter((i) => i.qty > 0).map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
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

      const res = await fetch(`/api/runs/${runId}/stream`, { signal: controller.signal });
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
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
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
          const kind = event.step === "notifyRestaurant" ? "restaurant-accept" : event.step === "assignDriver" ? "driver-accept" : "delivered";
          setTimeout(() => {
            void resume(kind as any, kind === "delivered" ? {} : { accepted: true });
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

  const resume = async (kind: "restaurant-accept" | "driver-accept" | "delivered", payload: object = {}) => {
    if (!currentOrderId) return;
    await fetch(`/api/orders/${currentOrderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  };

  const groupedMenu = cart.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof cart>);

  return (
    <div className={`min-h-screen bg-zinc-50 flex flex-col md:flex-row ${inter.className} text-[#042c34]`}>
      
      {/* LEFT COLUMN - Deliveroo App (60%) */}
      <div className="flex-1 border-r border-zinc-200 bg-white flex flex-col h-screen overflow-y-auto shadow-xl relative z-10 w-full md:w-[60%]">
        
        {/* Deliveroo Top Bar */}
        <div className="sticky top-0 z-50 bg-white border-b border-zinc-100 flex items-center justify-between px-4 md:px-6 py-3 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="text-[#00ccbc] font-extrabold text-2xl tracking-tighter cursor-pointer" onClick={() => { if (!running) setView('menu'); }}>
              deliveroo
            </div>
            <div className="hidden sm:flex bg-zinc-100 rounded-full px-4 py-2 text-sm items-center gap-2 cursor-pointer hover:bg-zinc-200 transition-colors">
              <MapPinIcon />
              <span className="font-medium text-zinc-700 truncate max-w-[150px]">{address || "Set location"}</span>
              <ChevronDownIcon />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 border border-zinc-200 rounded-full text-zinc-600 hover:bg-zinc-50">
              <SearchIcon />
            </button>
            <button className="p-2 border border-zinc-200 rounded-full text-zinc-600 hover:bg-zinc-50">
              <UserIcon />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {view === "menu" && (
            <div>
              {/* Hero */}
              <div className="relative h-48 md:h-64 bg-zinc-200 w-full overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&h=400&q=80" 
                  alt="Restaurant cover" 
                  className="w-full h-full object-cover object-center"
                />
              </div>

              {/* Restaurant Info */}
              <div className="px-4 md:px-10 py-6 max-w-4xl mx-auto w-full">
                <h1 className="text-3xl md:text-4xl font-extrabold text-[#042c34] mb-4">Burgers & Co (Downtown)</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-zinc-600 mb-6">
                  <span className="flex items-center gap-1 text-[#00ccbc] bg-[#00ccbc]/10 px-2 py-1 rounded-full"><StarIcon /> 4.8 Excellent (500+)</span>
                  <span className="flex items-center"><ClockIcon /> 25 - 40 min</span>
                  <span className="flex items-center"><BikeIcon /> £{deliveryFee} delivery</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">Burgers</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">American</span>
                </div>

                <div className="bg-[#00ccbc]/5 border border-[#00ccbc]/20 rounded-xl p-4 flex items-start sm:items-center gap-4 mb-8 flex-col sm:flex-row">
                  <div className="bg-[#00ccbc] text-white p-2 rounded-full hidden sm:block"><InfoIcon /></div>
                  <div className="flex-1">
                    <h3 className="font-bold text-[#042c34] text-base md:text-lg">Free delivery with Plus</h3>
                    <p className="text-sm text-zinc-600 mt-1">Get free delivery on orders over £15 when you join Deliveroo Plus.</p>
                  </div>
                </div>

                {/* Menu Layout */}
                <div className="flex flex-col lg:flex-row gap-8 items-start relative">
                  <div className="flex-1 pb-20">
                    {Object.entries(groupedMenu).map(([category, items]) => (
                      <div key={category} className="mb-10">
                        <h2 className="text-xl md:text-2xl font-bold text-[#042c34] mb-4 md:mb-6">{category}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {items.map((item) => (
                            <div key={item.id} className="border border-zinc-100 shadow-sm hover:shadow-md transition-shadow rounded-xl p-4 flex gap-4 bg-white cursor-pointer group" onClick={() => updateQty(item.id, 1)}>
                              <div className="flex-1 flex flex-col">
                                <h3 className="font-bold text-[#042c34] group-hover:text-[#00ccbc] transition-colors">{item.name}</h3>
                                <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{item.desc}</p>
                                <div className="mt-auto pt-4 text-zinc-900 font-semibold">£{item.price.toFixed(2)}</div>
                              </div>
                              <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 relative rounded-lg overflow-hidden border border-zinc-100">
                                <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                                <button 
                                  onClick={(e) => { e.stopPropagation(); updateQty(item.id, 1); }}
                                  className="absolute bottom-2 right-2 bg-white text-[#00ccbc] shadow-md border border-zinc-100 rounded-full w-8 h-8 flex items-center justify-center font-bold hover:scale-105 transition-transform"
                                >
                                  <PlusIcon />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sidebar Basket */}
                  <div className="w-full lg:w-80 lg:sticky lg:top-24 border border-zinc-200 rounded-xl bg-white shadow-sm overflow-hidden flex-shrink-0">
                    <div className="bg-[#fdfbf6] p-4 border-b border-zinc-200 text-center font-bold text-[#042c34] shadow-sm relative z-10 text-lg">
                      Your order
                    </div>
                    {totalItems === 0 ? (
                      <div className="p-8 text-center text-zinc-500 flex flex-col items-center">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-4 text-zinc-300">
                          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                          <line x1="3" y1="6" x2="21" y2="6"></line>
                          <path d="M16 10a4 4 0 0 1-8 0"></path>
                        </svg>
                        <p>Your basket is empty</p>
                      </div>
                    ) : (
                      <div className="flex flex-col lg:max-h-[60vh]">
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {cart.filter(i => i.qty > 0).map(item => (
                            <div key={item.id} className="flex gap-3 text-sm">
                              <div className="flex items-center gap-2 border border-zinc-200 rounded-full px-2 py-1 h-8 shrink-0">
                                <button onClick={() => updateQty(item.id, -1)} className="text-zinc-400 hover:text-zinc-800"><MinusIcon size={12} /></button>
                                <span className="font-semibold w-3 text-center">{item.qty}</span>
                                <button onClick={() => updateQty(item.id, 1)} className="text-zinc-400 hover:text-zinc-800"><PlusIcon size={12} /></button>
                              </div>
                              <div className="flex-1 font-medium">{item.name}</div>
                              <div className="font-semibold text-zinc-600">£{(item.price * item.qty).toFixed(2)}</div>
                            </div>
                          ))}
                        </div>
                        <div className="bg-zinc-50 p-4 border-t border-zinc-200">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-zinc-600">Subtotal</span>
                            <span className="font-medium">£{subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-zinc-600">Delivery</span>
                            <span className="font-medium">£{deliveryFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-4">
                            <span className="text-zinc-600">Service fee</span>
                            <span className="font-medium">£{serviceFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-xl text-[#042c34] mb-4">
                            <span>Total</span>
                            <span>£{total.toFixed(2)}</span>
                          </div>
                          <button 
                            onClick={() => setView("checkout")}
                            className="w-full bg-[#00ccbc] hover:bg-[#00b5a6] text-white font-bold py-3.5 px-4 rounded-lg transition-colors text-lg shadow-sm"
                          >
                            Go to checkout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === "checkout" && (
            <div className="max-w-2xl mx-auto w-full px-4 md:px-6 py-8">
              <button onClick={() => setView("menu")} className="text-[#00ccbc] font-semibold mb-6 flex items-center hover:underline">
                <ChevronLeftIcon /> Back to menu
              </button>
              <h1 className="text-3xl font-extrabold text-[#042c34] mb-8">Checkout</h1>
              
              <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6 shadow-sm">
                <h2 className="font-bold text-xl mb-4 flex items-center gap-2"><MapPinIcon /> Delivery details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Customer Name</label>
                    <input 
                      value={customerName} 
                      onChange={e => setCustomerName(e.target.value)} 
                      className="w-full border border-zinc-300 rounded-md p-2.5 focus:border-[#00ccbc] focus:ring-1 focus:ring-[#00ccbc] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Delivery Address</label>
                    <input 
                      value={address} 
                      onChange={e => setAddress(e.target.value)} 
                      className="w-full border border-zinc-300 rounded-md p-2.5 focus:border-[#00ccbc] focus:ring-1 focus:ring-[#00ccbc] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Delivery instructions</label>
                    <textarea 
                      placeholder="e.g. Leave at the door"
                      className="w-full border border-zinc-300 rounded-md p-2.5 focus:border-[#00ccbc] focus:ring-1 focus:ring-[#00ccbc] outline-none"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6 shadow-sm">
                <h2 className="font-bold text-xl mb-4">Order summary</h2>
                <div className="space-y-3 mb-4">
                  {cart.filter(i => i.qty > 0).map(item => (
                    <div key={item.id} className="flex justify-between">
                      <span className="font-medium text-zinc-700">{item.qty}x {item.name}</span>
                      <span className="text-zinc-600">£{(item.price * item.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-zinc-100 pt-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-zinc-600">Subtotal</span><span>£{subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-600">Delivery fee</span><span>£{deliveryFee.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-600">Service fee</span><span>£{serviceFee.toFixed(2)}</span></div>
                </div>
                <div className="border-t border-zinc-200 mt-4 pt-4 flex justify-between font-extrabold text-xl text-[#042c34]">
                  <span>Total</span>
                  <span>£{total.toFixed(2)}</span>
                </div>
              </div>

              <button 
                onClick={placeOrder}
                disabled={running}
                className="w-full bg-[#00ccbc] hover:bg-[#00b5a6] text-white font-bold text-lg py-4 px-4 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Place delivery order
              </button>
            </div>
          )}

          {view === "tracking" && (
            <div className="max-w-2xl mx-auto w-full px-4 md:px-6 py-8 flex flex-col items-center">
              <div className="w-full bg-[#fdfbf6] border border-zinc-200 rounded-2xl p-6 md:p-8 mb-8 text-center shadow-sm relative overflow-hidden">
                {/* Decorative blob */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#00ccbc]/10 rounded-full blur-3xl"></div>
                
                <h1 className="text-2xl md:text-3xl font-extrabold text-[#042c34] mb-2">
                  {result === "completed" ? "Order Delivered!" : 
                   result === "rolled_back" ? "Order Cancelled" : 
                   stepStatuses["trackDelivery"] === "success" ? "Arriving soon" :
                   stepStatuses["assignDriver"] === "success" ? "Rider heading to restaurant" :
                   stepStatuses["notifyRestaurant"] === "success" ? "Preparing your food" : "Processing order..."}
                </h1>
                
                {result !== "rolled_back" && result !== "completed" && (
                  <p className="text-[#00ccbc] font-bold text-lg md:text-xl mb-8 flex items-center justify-center gap-2">
                    <ClockIcon /> Arriving in 25 - 40 min
                  </p>
                )}

                {/* Status Bar */}
                <div className="flex justify-between items-center mb-8 relative px-4">
                  <div className="absolute left-4 right-4 h-1 bg-zinc-200 top-1/2 -translate-y-1/2 -z-10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#00ccbc] transition-all duration-1000 ease-out" 
                      style={{ 
                        width: result === 'completed' ? '100%' :
                               stepStatuses['trackDelivery'] === 'success' ? '100%' :
                               stepStatuses['assignDriver'] === 'success' ? '75%' : 
                               stepStatuses['notifyRestaurant'] === 'success' ? '50%' : '25%' 
                      }} 
                    />
                  </div>
                  {[1, 2, 3, 4].map((step) => {
                    const active = result === 'completed' || (
                      step === 1 ? !!stepStatuses['chargePayment'] :
                      step === 2 ? !!stepStatuses['notifyRestaurant'] :
                      step === 3 ? !!stepStatuses['assignDriver'] :
                      !!stepStatuses['trackDelivery']
                    );
                    return (
                      <div key={step} className={`w-6 h-6 rounded-full border-4 border-[#fdfbf6] flex items-center justify-center transition-colors duration-500 ${active ? 'bg-[#00ccbc]' : 'bg-zinc-300'}`}>
                        {active && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                    )
                  })}
                </div>

                {/* Rider Card */}
                {(stepStatuses['assignDriver'] === 'success' || stepStatuses['assignDriver'] === 'waiting' || stepStatuses['trackDelivery'] === 'running' || stepStatuses['trackDelivery'] === 'waiting') && result !== "rolled_back" && (
                  <div className="bg-white rounded-xl p-4 border border-zinc-200 shadow-sm flex items-center gap-4 text-left">
                    <div className="w-12 h-12 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200 shrink-0">
                      <img src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=100&h=100&q=80" alt="Rider" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-[#042c34]">Michael is your rider</h3>
                      <p className="text-sm text-zinc-500 flex items-center gap-1"><BikeIcon /> Bicycle</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="bg-zinc-100 p-2.5 rounded-full text-zinc-600 hover:bg-zinc-200"><MessageIcon /></button>
                      <button className="bg-zinc-100 p-2.5 rounded-full text-zinc-600 hover:bg-zinc-200"><PhoneIcon /></button>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Details List */}
              <div className="w-full bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-lg mb-4">Order Details</h3>
                <div className="space-y-4">
                  {STEPS.map((step, idx) => {
                    const status = stepStatuses[step.key] ?? "pending";
                    return (
                      <div key={step.key} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${
                            status === 'success' ? 'bg-[#00ccbc]' : 
                            status === 'failed' ? 'bg-red-500' :
                            status === 'running' || status === 'waiting' ? 'bg-amber-400 animate-pulse' :
                            status === 'skipped' ? 'bg-zinc-300' : 'bg-zinc-200'
                          }`} />
                          {idx !== STEPS.length - 1 && <div className="w-px h-full bg-zinc-200 my-1"></div>}
                        </div>
                        <div className={`pb-4 ${status === 'pending' ? 'opacity-40' : ''}`}>
                          <h4 className={`font-bold ${status === 'failed' ? 'text-red-500' : 'text-[#042c34]'}`}>{step.label}</h4>
                          <p className="text-sm text-zinc-500">{step.desc}</p>
                          {status === 'waiting' && (
                            <p className="text-xs text-amber-600 mt-1 font-semibold">Waiting for action...</p>
                          )}
                          {status === 'failed' && (
                            <p className="text-xs text-red-600 mt-1 font-semibold">Step failed.</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN - Developer / Saga Tools (40%) */}
      <div className="w-full md:w-[40%] bg-zinc-950 text-zinc-300 h-[50vh] md:h-screen overflow-y-auto flex flex-col text-sm border-t md:border-t-0 md:border-l border-zinc-800 shadow-2xl shrink-0">
        <div className="p-4 md:p-6 border-b border-zinc-800 bg-zinc-900 sticky top-0 z-20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-mono font-bold flex items-center gap-2">
              <TerminalIcon /> Saga Developer Console
            </h2>
            {result && (
              <span className={`px-2 py-1 text-[10px] rounded font-bold uppercase tracking-wider ${result === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {result}
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Simulate Failure</label>
              <select
                value={failAt ?? "null"}
                onChange={(e) => setFailAt(e.target.value === "null" ? null : (e.target.value as FailStep))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white font-mono text-[10px] md:text-xs focus:border-[#00ccbc] outline-none"
              >
                {FAIL_OPTIONS.map((opt) => (
                  <option key={String(opt.value)} value={opt.value ?? "null"}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoAck"
                checked={autoAck}
                onChange={(e) => setAutoAck(e.target.checked)}
                className="accent-[#00ccbc] cursor-pointer"
              />
              <label htmlFor="autoAck" className="text-[10px] md:text-xs text-zinc-400 select-none cursor-pointer">
                Auto-acknowledge hooks (delay 800ms)
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 flex-1 flex flex-col gap-6 min-h-0">
          {/* Manual Hook Controls */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 md:p-4 shrink-0">
            <h3 className="text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Manual Hook Controls</h3>
            <p className="text-[10px] text-zinc-500 mb-3 font-mono">Use when auto-ack is disabled to resume paused workflow.</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => resume("restaurant-accept", { accepted: true })} className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded text-[10px] md:text-xs transition-colors border border-zinc-700">
                Res: Accept
              </button>
              <button onClick={() => resume("restaurant-accept", { accepted: false, reason: "Out of stock" })} className="bg-red-950/30 hover:bg-red-900/50 text-red-400 p-2 rounded text-[10px] md:text-xs transition-colors border border-red-900/50">
                Res: Reject
              </button>
              <button onClick={() => resume("driver-accept", { accepted: true })} className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded text-[10px] md:text-xs transition-colors border border-zinc-700">
                Driver: Accept
              </button>
              <button onClick={() => resume("driver-accept", { accepted: false })} className="bg-red-950/30 hover:bg-red-900/50 text-red-400 p-2 rounded text-[10px] md:text-xs transition-colors border border-red-900/50">
                Driver: Reject
              </button>
              <button onClick={() => resume("delivered")} className="col-span-2 bg-[#00ccbc]/20 hover:bg-[#00ccbc]/30 text-[#00ccbc] p-2 rounded text-[10px] md:text-xs transition-colors border border-[#00ccbc]/30 font-bold">
                Mark Delivered
              </button>
            </div>
          </div>

          {/* Compensations */}
          {compensations.length > 0 && (
            <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3 md:p-4 shrink-0">
              <h3 className="text-[10px] md:text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Compensations Executed</h3>
              <ul className="list-disc pl-4 space-y-1 text-[10px] md:text-xs font-mono text-red-300/80">
                {compensations.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {/* Live Event Stream */}
          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 shrink-0">Live Event Feed</h3>
            <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2 md:p-3 overflow-y-auto font-mono text-[9px] md:text-[11px] leading-relaxed relative flex flex-col-reverse">
              {events.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-600">Waiting for events...</div>
              ) : (
                <div>
                  {events.map((e, i) => (
                    <div key={i} className="mb-1.5 pb-1.5 border-b border-zinc-800/50 last:border-0 last:mb-0 break-words">
                      <span className="text-zinc-600 mr-2">{new Date().toLocaleTimeString([], { hour12: false, second: '2-digit', fractionalSecondDigits: 3 })}</span>
                      <span className={`font-semibold ${eventColor(e.type)}`}>{e.type}</span>
                      <span className="text-zinc-400 ml-2">{summarizeEvent(e)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helpers
function eventColor(type: OrderEvent["type"]): string {
  if (type === "step_failed" || type === "compensating") return "text-red-400";
  if (type === "step_succeeded" || type === "hook_resolved" || type === "compensated") return "text-emerald-400";
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
      return `${e.label}${"detail" in e && e.detail ? ` — ${e.detail}` : ""}${"error" in e && e.error ? ` — ${e.error}` : ""}`;
    case "waiting_for_hook": return `[Token: ${e.token.slice(0, 6)}...] ${e.label}`;
    case "hook_resolved": return e.detail ?? e.token.slice(0, 6) + '...';
    case "compensation_pushed": return `${e.action} (for ${e.forStep})`;
    case "compensating":
    case "compensated": return e.action;
    case "log": return e.message;
    case "done": return `${e.status} — ${e.orderId}`;
    default: return "";
  }
}

// Simple Inline Icons
const MapPinIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ccbc" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>;
const ChevronDownIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ccbc" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>;
const ChevronLeftIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1"><path d="M15 18l-6-6 6-6" /></svg>;
const SearchIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>;
const UserIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const InfoIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>;
const PlusIcon = ({ size = 20 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>;
const MinusIcon = ({ size = 20 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /></svg>;
const MessageIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>;
const PhoneIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></svg>;
const TerminalIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>;
