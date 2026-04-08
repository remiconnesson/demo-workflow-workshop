"use client";

import React, { useState, useEffect, useRef } from "react";
import { Geist_Mono } from "next/font/google";

const font = Geist_Mono({ subsets: ["latin"], display: "swap" });

type OrderItem = { id: string; name: string; price: number; qty: number };
type FailStep = "validateOrder" | "chargePayment" | "notifyRestaurant" | "assignDriver" | "trackDelivery" | "sendReceipt" | null;
type OrderInput = {
  orderId: string;
  customerName: string;
  address: string;
  items: OrderItem[];
  failAt?: FailStep;
  autoAck?: boolean;
};

type OrderEvent =
  | { type: "step_running"; step: string; label: string }
  | { type: "step_succeeded"; step: string; label: string; detail?: string }
  | { type: "step_failed"; step: string; label: string; error: string }
  | { type: "step_skipped"; step: string; label: string }
  | { type: "waiting_for_hook"; step: string; token: string; label: string }
  | { type: "hook_resolved"; step: string; token: string; detail?: string }
  | { type: "compensation_pushed"; action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver"; forStep: string }
  | { type: "compensating"; action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver" }
  | { type: "compensated"; action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver" }
  | { type: "log"; message: string }
  | { type: "done"; status: "completed" | "rolled_back"; orderId: string; compensationOrder: string[] };

const MENU = [
  { id: "deployer", name: "The Deployer", price: 4.00, desc: "Triangle-shaped classic glazed." },
  { id: "edge", name: "Edge Runtime", price: 5.00, desc: "Fast-baked, served hot globally." },
  { id: "cold", name: "Cold Start", price: 3.50, desc: "Frozen custard filled triangle." },
  { id: "hot", name: "Hot Module", price: 4.50, desc: "Spicy cinnamon sugar dusted." },
  { id: "serverless", name: "Serverless Sprinkle", price: 6.00, desc: "Infinitely scalable sprinkles." },
];

const SAGA_STEPS = [
  "validateOrder",
  "chargePayment",
  "notifyRestaurant",
  "assignDriver",
  "trackDelivery",
  "sendReceipt"
];

const getHookKind = (step: string) => {
  if (step === "notifyRestaurant") return "restaurant-accept";
  if (step === "assignDriver") return "driver-accept";
  if (step === "trackDelivery") return "delivered";
  return "restaurant-accept";
};

export default function TriangleDonutsV24() {
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(false);
  
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("Vercel Admin");
  const [address, setAddress] = useState("340 S Lemon Ave, CA");
  
  const [orderStatus, setOrderStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [orderId, setOrderId] = useState<string>("");
  const [runId, setRunId] = useState<string>("");
  
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [stepStatuses, setStepStatuses] = useState<Record<string, string>>({});
  const [pendingHook, setPendingHook] = useState<{ step: string; token: string } | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const getQty = (id: string) => cart[id] || 0;
  const inc = (id: string) => setCart(p => ({ ...p, [id]: getQty(id) + 1 }));
  const dec = (id: string) => setCart(p => ({ ...p, [id]: Math.max(0, getQty(id) - 1) }));
  
  const totalQty = MENU.reduce((sum, item) => sum + getQty(item.id), 0);
  const items: OrderItem[] = MENU.filter(m => getQty(m.id) > 0).map(m => ({
    id: m.id,
    name: m.name,
    price: m.price,
    qty: getQty(m.id)
  }));

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  useEffect(() => {
    if (autoAck && pendingHook) {
      const timer = setTimeout(() => {
        resumeHook(getHookKind(pendingHook.step), true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [autoAck, pendingHook]);

  const handleEvent = (ev: OrderEvent) => {
    setEvents(prev => [...prev, ev]);
    const e = ev as any;
    
    if (ev.type === "step_running") {
      setStepStatuses(prev => ({ ...prev, [e.step]: "running" }));
      setCurrentStep(e.step);
    } else if (ev.type === "step_succeeded") {
      setStepStatuses(prev => ({ ...prev, [e.step]: "success" }));
    } else if (ev.type === "step_failed") {
      setStepStatuses(prev => ({ ...prev, [e.step]: "failed" }));
    } else if (ev.type === "step_skipped") {
      setStepStatuses(prev => ({ ...prev, [e.step]: "skipped" }));
    } else if (ev.type === "waiting_for_hook") {
      setStepStatuses(prev => ({ ...prev, [e.step]: "waiting" }));
      setPendingHook({ step: e.step, token: e.token });
    } else if (ev.type === "hook_resolved") {
      setPendingHook(null);
    } else if (ev.type === "compensated") {
      setCompensations(prev => [...prev, e.action]);
    } else if (ev.type === "done") {
      setOrderStatus(e.status === "completed" ? "done" : "error");
    }
  };

  const placeOrder = async () => {
    setOrderStatus("running");
    setEvents([]);
    setStepStatuses({});
    setCurrentStep("");
    setPendingHook(null);
    setCompensations([]);

    const newOrderId = `ORD-${Math.floor(Math.random() * 100000)}`;
    setOrderId(newOrderId);

    try {
      const res = await fetch("/api/orders/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: newOrderId,
          customerName,
          address,
          items,
          failAt,
          autoAck
        } satisfies OrderInput)
      });
      const data = await res.json();
      setRunId(data.runId);

      const streamRes = await fetch(`/api/runs/${data.runId}/stream`);
      if (!streamRes.body) return;
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) {
            const ev = JSON.parse(line) as OrderEvent;
            handleEvent(ev);
          }
        }
      }
      if (buffer.trim()) {
        const ev = JSON.parse(buffer) as OrderEvent;
        handleEvent(ev);
      }
    } catch (err) {
      console.error(err);
      setOrderStatus("error");
    }
  };

  const resumeHook = async (kind: string, accepted: boolean) => {
    if (!orderId) return;
    try {
      await fetch(`/api/orders/${orderId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, accepted })
      });
      setPendingHook(null);
    } catch (err) {
      console.error(err);
    }
  };

  const AsciiProgress = () => {
    let currentIndex = currentStep ? SAGA_STEPS.indexOf(currentStep) : -1;
    if (orderStatus === 'idle') currentIndex = -1;
    if (orderStatus === 'done') currentIndex = 5; 
    
    const activeCount = orderStatus === 'done' ? 6 : (currentIndex >= 0 ? currentIndex + 1 : 0);

    const blocks = Array(6).fill('░');
    const triangles = Array(6).fill('░');
    for (let i = 0; i < 6; i++) {
      if (i < activeCount) {
        blocks[i] = '█';
        triangles[i] = '▲';
      }
    }
    
    const isRunning = orderStatus === 'running';
    const isError = orderStatus === 'error';
    
    if (isRunning && currentIndex >= 0 && currentIndex < 6) {
      blocks[currentIndex] = '█';
      triangles[currentIndex] = '▲';
    }

    let color = 'text-[#00ff88]';
    if (isError) color = 'text-red-500';
    if (isRunning) color = 'text-yellow-400';

    return (
      <div className="flex flex-col gap-6 bg-white/5 border-4 border-white/20 p-10 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:100%_4px] z-50"></div>
        <div className="text-3xl text-white/50 uppercase tracking-widest relative z-10">Saga Progress</div>
        <div className={`text-[80px] leading-none ${color} flex items-center gap-10 tracking-widest whitespace-nowrap overflow-hidden relative z-10`}>
          <span>[{blocks.join('')}]</span>
          <span>{activeCount}/6</span>
          <span className="w-[500px] truncate">{currentStep || 'IDLE'}</span>
          <span>{triangles.join('')}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-black text-white p-12 xl:p-24 flex flex-col xl:flex-row gap-24 ${font.className}`}>
      
      {/* PHONE TERMINAL */}
      <div className="w-[700px] h-[1300px] shrink-0 border-4 border-white/20 rounded-[50px] overflow-hidden flex flex-col relative bg-black shadow-[0_0_120px_rgba(0,255,136,0.1)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:100%_4px] z-50"></div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.6)_100%)] z-50"></div>
        
        <div className="h-20 border-b-4 border-white/20 flex items-center px-10 text-3xl text-white/50 shrink-0 bg-white/5 relative z-10">
          ▲ triangle-donuts v1.0.0 — terminal
        </div>
        
        <div className="flex-1 overflow-y-auto p-12 flex flex-col gap-16 relative z-10">
          {orderStatus === "idle" ? (
            <div className="flex flex-col gap-14">
              <div className="text-5xl text-[#00ff88] animate-pulse">~ $ ./donuts --menu</div>
              <div className="flex flex-col gap-12">
                {MENU.map(item => (
                  <div key={item.id} className="flex flex-col gap-4 border-b-4 border-white/10 pb-8 border-dotted">
                    <div className="flex justify-between items-end">
                      <div className="text-5xl font-bold text-white tracking-wide">{item.name}</div>
                      <div className="text-5xl text-[#00ff88]">${item.price.toFixed(2)}</div>
                    </div>
                    <div className="text-3xl text-white/60">{item.desc}</div>
                    <div className="flex items-center gap-8 mt-6">
                      <button onClick={() => dec(item.id)} className="text-6xl text-[#00ff88] border-4 border-[#00ff88] w-20 h-20 flex items-center justify-center hover:bg-[#00ff88]/20 focus:outline-none font-bold">[-]</button>
                      <span className="text-6xl w-20 text-center font-bold">{getQty(item.id)}</span>
                      <button onClick={() => inc(item.id)} className="text-6xl text-[#00ff88] border-4 border-[#00ff88] w-20 h-20 flex items-center justify-center hover:bg-[#00ff88]/20 focus:outline-none font-bold">[+]</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-5xl text-[#00ff88] mt-16">~ $ ./donuts --checkout</div>
              
              <div className="flex flex-col gap-12">
                <div className="flex flex-col gap-8">
                  <label className="text-4xl text-white/80 uppercase tracking-widest">? Customer Name ›</label>
                  <input 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)}
                    className="bg-white/5 border-b-4 border-white/40 text-5xl text-white p-6 focus:outline-none focus:border-[#00ff88] font-bold"
                    spellCheck={false}
                    placeholder="Name..."
                  />
                </div>
                <div className="flex flex-col gap-8">
                  <label className="text-4xl text-white/80 uppercase tracking-widest">? Delivery Address ›</label>
                  <input 
                    value={address} 
                    onChange={e => setAddress(e.target.value)}
                    className="bg-white/5 border-b-4 border-white/40 text-5xl text-white p-6 focus:outline-none focus:border-[#00ff88] font-bold"
                    spellCheck={false}
                    placeholder="Address..."
                  />
                </div>
              </div>

              <button 
                onClick={placeOrder}
                disabled={totalQty === 0 || !customerName || !address}
                className="mt-20 text-6xl bg-[#00ff88] text-black py-10 px-12 uppercase font-bold hover:bg-[#00cc6a] disabled:opacity-50 disabled:bg-white/20 disabled:text-white/50 transition-colors"
              >
                [ ENTER ] PLACE ORDER
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-16">
              <div className="text-4xl text-[#00ff88]">~ $ tail -f /var/log/order-{orderId?.slice(0,6)}.log</div>
              
              <div className="flex flex-col gap-14">
                {SAGA_STEPS.map((step) => {
                  const status = stepStatuses[step] || 'pending';
                  let icon = '[ ]';
                  let color = 'text-white/40';
                  if (status === 'running') { icon = '[~]'; color = 'text-yellow-400 animate-pulse'; }
                  else if (status === 'waiting') { icon = '[…]'; color = 'text-yellow-400'; }
                  else if (status === 'success') { icon = '[✓]'; color = 'text-[#00ff88]'; }
                  else if (status === 'failed') { icon = '[✗]'; color = 'text-red-500'; }
                  else if (status === 'skipped') { icon = '[-]'; color = 'text-white/40 line-through'; }

                  return (
                    <div key={step} className={`text-5xl flex gap-10 items-center ${color}`}>
                      <span className="w-24 shrink-0 font-bold">{icon}</span>
                      <span className="break-words font-bold">{step}</span>
                    </div>
                  );
                })}
              </div>

              {orderStatus === 'done' && (
                <div className="mt-20 text-6xl text-black bg-[#00ff88] font-bold p-12 text-center uppercase tracking-widest shadow-[0_0_60px_rgba(0,255,136,0.4)]">
                  ORDER COMPLETE ▲
                </div>
              )}
              {orderStatus === 'error' && (
                <div className="mt-20 text-6xl text-black bg-red-500 font-bold p-12 text-center uppercase tracking-widest shadow-[0_0_60px_rgba(239,68,68,0.4)]">
                  ORDER FAILED ✗
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* DASHBOARD */}
      <div className="flex-1 flex flex-col gap-20 min-w-[1000px]">
        <div className="text-[100px] leading-none font-bold text-white tracking-tighter uppercase flex items-center gap-12">
          <span className="text-[#00ff88]">▲</span> VERCEL SAGA_MONITOR
        </div>

        <div className="flex gap-24 border-y-4 border-white/20 py-16">
          <div className="flex flex-col gap-8 flex-1">
            <div className="text-4xl text-white/50 uppercase tracking-widest">Fail At Step</div>
            <select 
              value={failAt || ""} 
              onChange={e => setFailAt(e.target.value as FailStep)}
              className="bg-black text-5xl text-[#00ff88] border-4 border-white/20 p-8 appearance-none focus:outline-none focus:border-[#00ff88] font-bold"
            >
              <option value="">-- None --</option>
              {SAGA_STEPS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-8 flex-1">
            <div className="text-4xl text-white/50 uppercase tracking-widest">Auto Ack Hooks</div>
            <button 
              onClick={() => setAutoAck(!autoAck)}
              className={`text-5xl p-8 border-4 font-bold ${autoAck ? 'border-[#00ff88] text-[#00ff88] bg-[#00ff88]/10' : 'border-white/20 text-white/50 bg-white/5'}`}
            >
              {autoAck ? '[ ON ]' : '[ OFF ]'}
            </button>
          </div>
        </div>

        <AsciiProgress />

        {pendingHook && !autoAck && (
          <div className="border-4 border-yellow-400 p-14 flex flex-col gap-12 bg-yellow-400/5 shadow-[0_0_80px_rgba(250,204,21,0.1)] relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:100%_4px] z-50"></div>
            <div className="text-5xl text-yellow-400 animate-pulse font-bold uppercase tracking-wider relative z-10">
              › WAITING FOR HOOK: {pendingHook.step}
            </div>
            <div className="flex gap-12 relative z-10">
              <button onClick={() => resumeHook(getHookKind(pendingHook.step), true)} className="flex-1 text-5xl bg-yellow-400 text-black px-14 py-10 font-bold hover:bg-yellow-300">
                 [ APPROVE ]
              </button>
              <button onClick={() => resumeHook(getHookKind(pendingHook.step), false)} className="flex-1 text-5xl bg-transparent border-4 border-red-500 text-red-500 px-14 py-10 font-bold hover:bg-red-500/10">
                 [ REJECT ]
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-[600px] border-4 border-white/20 bg-black p-12 overflow-y-auto flex flex-col gap-6 relative shadow-[inset_0_0_100px_rgba(255,255,255,0.05)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:100%_4px] z-50"></div>

          {events.length === 0 && (
            <div className="text-white/30 text-5xl absolute inset-0 flex items-center justify-center font-bold tracking-widest uppercase">
               [ WAITING FOR EVENTS... ]
            </div>
          )}
          {events.map((e, i) => {
            const ts = new Date().toISOString().split('T')[1].slice(0, 12);
            let color = "text-white/80";
            let icon = "▲";
            let text = "";

            const ev = e as any;
            if (e.type === "step_running") {
              color = "text-cyan-400"; text = `[RUNNING] ${ev.step}`;
            } else if (e.type === "step_succeeded") {
              color = "text-[#00ff88]"; text = `[SUCCESS] ${ev.step}`;
            } else if (e.type === "step_failed") {
              color = "text-red-500"; text = `[FAILED] ${ev.step} - ${ev.error}`;
            } else if (e.type === "step_skipped") {
              color = "text-white/40"; text = `[SKIPPED] ${ev.step}`;
            } else if (e.type === "waiting_for_hook") {
              color = "text-yellow-400"; text = `[WAITING] ${ev.step} (token: ${ev.token.slice(0,8)}...)`;
            } else if (e.type === "hook_resolved") {
              color = "text-[#00ff88]"; text = `[RESOLVED] ${ev.step}`;
            } else if (e.type === "compensation_pushed") {
              color = "text-purple-400"; text = `[COMP_PUSH] ${ev.action} for ${ev.forStep}`;
            } else if (e.type === "compensating") {
              color = "text-purple-400"; text = `[COMPENSATING] ${ev.action}`;
            } else if (e.type === "compensated") {
              color = "text-purple-500"; text = `[COMPENSATED] ${ev.action}`;
            } else if (e.type === "log") {
              color = "text-white/60"; text = `[LOG] ${ev.message}`; icon = "›";
            } else if (e.type === "done") {
              color = ev.status === "completed" ? "text-[#00ff88]" : "text-red-500";
              text = `[DONE] Status: ${ev.status}`;
            }

            return (
              <div key={i} className={`flex gap-10 ${color} hover:bg-white/5 p-4 rounded-xl relative z-10 text-4xl`}>
                <span className="text-white/30 w-64 shrink-0">{ts}</span>
                <span className="shrink-0">{icon}</span>
                <span className="break-all">{text}</span>
              </div>
            );
          })}
          <div ref={logsEndRef} className="pb-10 relative z-10" />
        </div>
      </div>

    </div>
  );
}
