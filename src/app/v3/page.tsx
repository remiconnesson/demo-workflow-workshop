"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

// --- Types & Constants ---

const COLORS = {
  peach: "#ffd6a5",
  mint: "#b9fbc0",
  lavender: "#cdb4db",
  yellow: "#fdffb6",
  blue: "#a0c4ff",
};

const MENU: (OrderItem & { emoji: string })[] = [
  { id: "pho", name: "Beef Phở", price: 14, qty: 0, emoji: "🍜" },
  { id: "baguette", name: "Fresh Baguette", price: 4, qty: 0, emoji: "🥖" },
  { id: "dumplings", name: "Pork Dumplings", price: 12, qty: 0, emoji: "🥟" },
  { id: "boba", name: "Milk Tea Boba", price: 7, qty: 0, emoji: "🧋" },
];

const STEPS: { key: string; label: string; icon: string }[] = [
  { key: "validateOrder", label: "Check-it!", icon: "📝" },
  { key: "chargeCard", label: "Ka-ching!", icon: "💰" },
  { key: "pingRestaurant", label: "Cooking!", icon: "👨‍🍳" },
  { key: "findDriver", label: "Zooming!", icon: "🛵" },
  { key: "trackDelivery", label: "Almost!", icon: "📍" },
  { key: "sendReceipts", label: "Donezo!", icon: "💌" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "Perfect Day! ☀️" },
  { value: "validateOrder", label: "Oops, Bad Order ❌" },
  { value: "chargeCard", label: "No Money! 💸" },
  { value: "pingRestaurant", label: "Kitchen Fire! 🔥" },
  { value: "findDriver", label: "Flat Tire! 🚲" },
  { value: "sendReceipts", label: "Email Broke! 📧" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

// --- Components ---

function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute h-4 w-4 rounded-full opacity-80"
          style={{
            backgroundColor: Object.values(COLORS)[i % 5],
            left: `${Math.random() * 100}%`,
            top: `-20px`,
            animation: `fall ${2 + Math.random() * 3}s linear forwards`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}
    </div>
  );
}

function Scooter() {
  return (
    <div className="pointer-events-none absolute top-4 left-0 w-full overflow-hidden h-16">
      <div className="animate-drive text-4xl">🛵💨</div>
    </div>
  );
}

function Card({ children, title, color = COLORS.lavender, icon }: { children: React.ReactNode; title: string; color?: string; icon?: string }) {
  return (
    <div 
      className="relative rounded-3xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
      style={{ backgroundColor: color }}
    >
      <div className="mb-4 flex items-center gap-2">
        {icon && <span className="text-2xl">{icon}</span>}
        <h2 className="text-xl font-black text-zinc-800 uppercase tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// --- Main Page ---

export default function PlayfulCartoonPage() {
  const [cart, setCart] = useState<(OrderItem & { emoji: string })[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "pho" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("Happy Panda");
  const [address, setAddress] = useState("888 Bamboo Forest Lane");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);

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
    setRunning(false);
  };

  const resume = async (kind: string, payload: object = {}) => {
    if (!currentOrderId) return;
    await fetch(`/api/orders/${currentOrderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  };

  const applyEvent = useCallback((event: OrderEvent) => {
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
            event.step === "pingRestaurant"
              ? "restaurant-accept"
              : event.step === "findDriver"
                ? "driver-accept"
                : "delivered";
          setTimeout(() => {
            void resume(kind, kind === "delivered" ? {} : { accepted: true });
          }, 1200);
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
  }, [autoAck, currentOrderId]);

  const applyEventRef = useRef(applyEvent);
  useEffect(() => {
    applyEventRef.current = applyEvent;
  }, [applyEvent]);

  const placeOrder = async () => {
    reset();
    setRunning(true);

    const orderId = `ord_${Math.random().toString(36).slice(2, 9)}`;
    setCurrentOrderId(orderId);

    const input: OrderInput = {
      orderId,
      customerName,
      address,
      items: cart.filter((i) => i.qty > 0).map(({id, name, price, qty}) => ({id, name, price, qty})),
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

      const res = await fetch(`/api/runs/${runId}/stream`, {
        signal: controller.signal,
      });
      if (!res.body) throw new Error("No body");
      
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
            applyEventRef.current(event);
          } catch (e) { console.error("Parse err", e); }
        }
      }
    } catch (e) {
      console.error("Stream err", e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fffcf2] p-4 md:p-8 font-[system-ui]">
      <style>{`
        @keyframes fall {
          to { transform: translateY(100vh) rotate(360deg); }
        }
        @keyframes drive {
          from { transform: translateX(-100px); }
          to { transform: translateX(100vw); }
        }
        .animate-drive {
          animation: drive 8s linear infinite;
        }
        @keyframes bounce-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 2s infinite ease-in-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px) rotate(-5deg); }
          75% { transform: translateX(5px) rotate(5deg); }
        }
        .animate-shake {
          animation: shake 0.2s infinite;
        }
        @keyframes puff {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-puff {
          animation: puff 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>

      {result === "completed" && <Confetti />}
      
      <header className="relative mb-12 flex flex-col items-center">
        <div className="relative z-10 text-center">
          <h1 className="text-5xl md:text-6xl font-black text-zinc-900 mb-2 drop-shadow-sm italic">
            YUMMY <span className="text-[#a0c4ff]">DASH!</span>
          </h1>
          <p className="text-lg font-bold text-zinc-500 uppercase tracking-widest">The Goofiest Delivery in Town</p>
        </div>
        <div className="w-full max-w-4xl border-b-4 border-dashed border-zinc-200 mt-8 relative">
          {running && <Scooter />}
        </div>
      </header>

      <main className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
        
        <div className="space-y-8">
          <Card title="Menu" color={COLORS.peach} icon="🍕">
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-white/50 p-4 rounded-3xl">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl animate-bounce" style={{ animationDelay: `${Math.random()}s`, animationDuration: "2s" }}>{item.emoji}</span>
                    <div>
                      <div className="font-black text-zinc-800">{item.name}</div>
                      <div className="text-sm font-bold text-zinc-500">${item.price}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-white rounded-full p-1 shadow-inner">
                    <button onClick={() => updateQty(item.id, -1)} className="h-10 w-10 rounded-full flex items-center justify-center font-black text-xl hover:bg-zinc-100 transition-colors">-</button>
                    <span className="w-4 text-center font-black text-lg">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="h-10 w-10 rounded-full bg-zinc-800 text-white flex items-center justify-center font-black text-xl hover:bg-zinc-700 transition-colors">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-between items-center px-4">
              <span className="text-zinc-600 font-bold uppercase text-sm">Total Munchies:</span>
              <span className="text-2xl font-black text-zinc-900">${total}</span>
            </div>
          </Card>

          <Card title="Who's Hungry?" color={COLORS.mint} icon="🐻">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-zinc-500 uppercase mb-1 ml-2">Name</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-white rounded-2xl px-4 py-3 font-bold text-zinc-800 border-none ring-4 ring-transparent focus:ring-zinc-800 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-black text-zinc-500 uppercase mb-1 ml-2">Address</label>
                <input value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-white rounded-2xl px-4 py-3 font-bold text-zinc-800 border-none ring-4 ring-transparent focus:ring-zinc-800 outline-none transition-all" />
              </div>
            </div>
          </Card>

          <Card title="Chaos Mode" color={COLORS.yellow} icon="🎲">
            <div className="space-y-4">
              <select value={failAt ?? "null"} onChange={e => setFailAt(e.target.value === "null" ? null : e.target.value as FailStep)} className="w-full bg-white rounded-2xl px-4 py-3 font-bold text-zinc-800 border-none outline-none appearance-none cursor-pointer">
                {FAIL_OPTIONS.map(opt => <option key={String(opt.value)} value={opt.value ?? "null"}>{opt.label}</option>)}
              </select>
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={autoAck} onChange={e => setAutoAck(e.target.checked)} />
                  <div className={`w-12 h-6 rounded-full transition-colors ${autoAck ? 'bg-zinc-800' : 'bg-zinc-300'}`} />
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${autoAck ? 'translate-x-6' : ''}`} />
                </div>
                <span className="font-bold text-zinc-700 text-sm">Auto-Zoom Mode</span>
              </label>
            </div>
          </Card>

          <div className="flex gap-4">
            <button onClick={placeOrder} disabled={running || total === 0} className="flex-1 bg-zinc-900 text-white rounded-full py-5 text-xl font-black shadow-[0_6px_0_0_#000] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase italic tracking-tighter">{running ? "Sending It! 🚀" : "Place Order! 🎉"}</button>
            <button onClick={reset} disabled={running} className="bg-white text-zinc-900 border-4 border-zinc-900 rounded-full px-8 py-5 text-xl font-black shadow-[0_6px_0_0_#000] active:translate-y-1 active:shadow-none transition-all disabled:opacity-30 uppercase">Reset</button>
          </div>
        </div>

        <div className="space-y-8">
          <Card title="Delivery Status" color={COLORS.blue} icon="🌈">
            <div className="grid grid-cols-2 gap-4">
              {STEPS.map((step) => {
                const status = stepStatuses[step.key] ?? "pending";
                return (
                  <div key={step.key} className={`relative rounded-3xl p-4 flex flex-col items-center justify-center text-center transition-all duration-500 ${status === 'pending' ? 'bg-white/30 opacity-60' : 'bg-white shadow-md scale-100'} ${status === 'running' || status === 'waiting' ? 'animate-bounce-gentle ring-4 ring-white' : ''} ${status === 'success' ? 'scale-105' : ''} ${status === 'failed' ? 'animate-shake bg-red-100' : ''}`}>
                    <span className={`text-4xl mb-2 ${status === 'pending' ? 'grayscale' : ''}`}>{step.icon}</span>
                    <div className="font-black text-zinc-800 text-sm leading-tight">{step.label}</div>
                    <div className={`mt-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${status === 'success' ? 'bg-emerald-400 text-emerald-900' : ''} ${status === 'failed' ? 'bg-red-400 text-red-900' : ''} ${status === 'running' ? 'bg-sky-400 text-sky-900' : ''} ${status === 'waiting' ? 'bg-amber-400 text-amber-900' : ''} ${status === 'pending' ? 'bg-zinc-200 text-zinc-500' : ''}`}>{status}</div>
                  </div>
                );
              })}
            </div>
            {result && (
              <div className={`mt-8 p-6 rounded-3xl text-center animate-puff ${result === 'completed' ? 'bg-emerald-400' : 'bg-red-400'} shadow-[0_8px_0_0_rgba(0,0,0,0.1)]`}>
                <div className="text-4xl mb-2">{result === 'completed' ? 'YUM! 🎉' : 'OH NO! 😭'}</div>
                <div className="font-black text-zinc-900 uppercase">{result === 'completed' ? "It's Munchy Time!" : "Something went wonky..."}</div>
              </div>
            )}
          </Card>

          <Card title="Buttons!" color={COLORS.peach} icon="🎮">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button onClick={() => resume("restaurant-accept", { accepted: true })} className="bg-white hover:bg-zinc-50 p-3 rounded-2xl font-black text-xs uppercase shadow-[0_4px_0_0_#ddd] active:translate-y-1 active:shadow-none transition-all">Resto: YES! 👨‍🍳</button>
                <button onClick={() => resume("restaurant-accept", { accepted: false, reason: "No food left!" })} className="bg-red-400 text-white p-3 rounded-2xl font-black text-xs uppercase shadow-[0_4px_0_0_#991b1b] active:translate-y-1 active:shadow-none transition-all">Resto: NOPE! ❌</button>
                <button onClick={() => resume("driver-accept", { accepted: true })} className="bg-white hover:bg-zinc-50 p-3 rounded-2xl font-black text-xs uppercase shadow-[0_4px_0_0_#ddd] active:translate-y-1 active:shadow-none transition-all">Driver: YES! 🛵</button>
                <button onClick={() => resume("driver-accept", { accepted: false })} className="bg-red-400 text-white p-3 rounded-2xl font-black text-xs uppercase shadow-[0_4px_0_0_#991b1b] active:translate-y-1 active:shadow-none transition-all">Driver: NOPE! ❌</button>
                <button onClick={() => resume("delivered")} className="col-span-full bg-emerald-400 text-white p-4 rounded-2xl font-black text-sm uppercase shadow-[0_4px_0_0_#065f46] active:translate-y-1 active:shadow-none transition-all">Gimme My Food! 🎁</button>
             </div>
          </Card>

          <Card title="Raw Events" color="#fff" icon="📠">
            <div ref={scrollRef} className="h-48 overflow-auto font-mono text-[10px] bg-zinc-900 rounded-2xl p-4 text-zinc-400 scroll-smooth">
              {events.length === 0 ? "Beep boop, waiting for data..." : events.map((e, i) => <div key={i} className="mb-1"><span className="text-zinc-600">[{i}]</span> {JSON.stringify(e)}</div>)}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
