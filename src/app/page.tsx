"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import {
  FAIL_OPTIONS,
  ORDER_STEPS as STEPS,
  type FailStep,
} from "@/lib/order-contract";
import type { OrderEvent, OrderItem } from "@/workflows/place-order";
import { useOrderRun, type OrderRunScenario } from "@/lib/order-run-client";


const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

type MenuItem = OrderItem & { desc: string };

const MENU: MenuItem[] = [
  { id: "deployer", name: "The Deployer", desc: "Classic glazed · vanilla", price: 4.0, qty: 0 },
  { id: "edge", name: "Edge Runtime", desc: "Powdered sugar · fast", price: 4.5, qty: 0 },
  { id: "cold", name: "Cold Start", desc: "Frozen icing · crisp", price: 5.0, qty: 0 },
  { id: "hot", name: "Hot Module", desc: "Molten cinnamon core", price: 4.5, qty: 0 },
  { id: "isr", name: "ISR Glaze", desc: "Revalidates on taste", price: 5.5, qty: 0 },
];


function TriangleMark({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 24 22" className={className} aria-hidden>
      <path d="M12 0 L24 22 L0 22 Z" fill="currentColor" />
    </svg>
  );
}

const HOTSPOT_COLORS = {
  emerald: {
    idle: "bg-emerald-500/30 shadow-emerald-500/0",
    active: "bg-emerald-400 shadow-emerald-400/60",
    label: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  },
  red: {
    idle: "bg-red-500/30 shadow-red-500/0",
    active: "bg-red-400 shadow-red-400/60",
    label: "bg-red-500/10 border-red-500/30 text-red-300",
  },
  sky: {
    idle: "bg-sky-500/30 shadow-sky-500/0",
    active: "bg-sky-400 shadow-sky-400/60",
    label: "bg-sky-500/10 border-sky-500/30 text-sky-300",
  },
  amber: {
    idle: "bg-amber-500/30 shadow-amber-500/0",
    active: "bg-amber-400 shadow-amber-400/60",
    label: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  },
  fuchsia: {
    idle: "bg-fuchsia-500/30 shadow-fuchsia-500/0",
    active: "bg-fuchsia-400 shadow-fuchsia-400/60",
    label: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300",
  },
} as const;

function SlideHotspot({
  href,
  label,
  active,
  color,
}: {
  href: string;
  label: string;
  active: boolean;
  color: keyof typeof HOTSPOT_COLORS;
}) {
  const c = HOTSPOT_COLORS[color];
  return (
    <Link
      href={href}
      className="group relative z-20 flex items-center"
      title={label}
    >
      {/* larger hit area */}
      <span className="absolute -inset-4" />
      {/* dot */}
      <span
        className={`relative h-2.5 w-2.5 rounded-full transition-all duration-500 ${
          active
            ? `${c.active} shadow-[0_0_12px_3px] animate-pulse`
            : `${c.idle} shadow-[0_0_0px_0px]`
        } group-hover:scale-[2] group-hover:shadow-[0_0_16px_4px]`}
      />
      {/* label on hover */}
      <span
        className={`pointer-events-none absolute left-6 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-semibold opacity-0 transition-opacity group-hover:opacity-100 ${c.label}`}
      >
        {label}
      </span>
    </Link>
  );
}

type DemoPhase =
  | "idle"
  | "running"
  | "waiting"
  | "completed"
  | "rolled_back"
  | "error";

function getDemoPhase(args: {
  running: boolean;
  waitingOn: string | null;
  doneStatus: "completed" | "rolled_back" | null;
  error: string | null;
}): DemoPhase {
  if (args.error) return "error";
  if (args.waitingOn) return "waiting";
  if (args.doneStatus === "completed") return "completed";
  if (args.doneStatus === "rolled_back") return "rolled_back";
  if (args.running) return "running";
  return "idle";
}

function phaseCardClass(phase: DemoPhase): string {
  switch (phase) {
    case "running":
      return "border-sky-400/30 bg-sky-400/5 text-sky-100";
    case "waiting":
      return "border-amber-400/30 bg-amber-400/5 text-amber-100";
    case "completed":
      return "border-emerald-400/30 bg-emerald-400/5 text-emerald-100";
    case "rolled_back":
      return "border-fuchsia-400/30 bg-fuchsia-400/5 text-fuchsia-100";
    case "error":
      return "border-red-400/30 bg-red-400/5 text-red-100";
    default:
      return "border-white/10 bg-white/5 text-zinc-200";
  }
}

function formatCountdown(ms: number | null): string | null {
  if (ms === null) return null;
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

function formatEventLine(e: OrderEvent): { kind: string; msg: string } {
  switch (e.type) {
    case "step_running":
      return { kind: "RUN", msg: `${e.step} · ${e.label}` };
    case "step_succeeded":
      return { kind: "OK ", msg: `${e.step}${e.detail ? ` · ${e.detail}` : ""}` };
    case "step_failed":
      return { kind: "ERR", msg: `${e.step} · ${e.error}` };
    case "step_skipped":
      return { kind: "SKP", msg: `${e.step}` };
    case "waiting_for_hook":
      return { kind: "WAI", msg: `${e.step} · awaiting ${e.token}` };
    case "hook_resolved":
      return { kind: "HOK", msg: `${e.step}${e.detail ? ` · ${e.detail}` : ""}` };
    case "compensation_pushed":
      return { kind: "CMP", msg: `pushed ${e.action} (for ${e.forStep})` };
    case "compensating":
      return { kind: "CMP", msg: `running ${e.action}` };
    case "compensated":
      return { kind: "CMP", msg: `done ${e.action}` };
    case "log":
      return { kind: "LOG", msg: e.message };
    case "done":
      return { kind: "END", msg: `${e.status} · ${e.orderId}` };
  }
}

function kindColor(kind: string) {
  switch (kind) {
    case "OK ":
      return "text-emerald-400";
    case "ERR":
      return "text-red-400";
    case "WAI":
    case "HOK":
      return "text-amber-400";
    case "CMP":
      return "text-fuchsia-400";
    case "RUN":
      return "text-sky-400";
    case "END":
      return "text-white";
    default:
      return "text-zinc-500";
  }
}

function formatEventTime(date: Date = new Date()): string {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function V29Page() {
  const [cart, setCart] = useState<MenuItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "deployer" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("Ada Lovelace");
  const [address, setAddress] = useState("440 N Wolfe Rd, Sunnyvale");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);

  const cartItems = cart.filter((i) => i.qty > 0);

  const scenario = useMemo<OrderRunScenario>(
    () => ({
      scenarioId: "main-demo",
      title: "Triangle Donuts",
      input: {
        customerName,
        address,
        items: cartItems.map(({ id, name, price, qty }) => ({
          id,
          name,
          price,
          qty,
        })),
        failAt,
        autoAck,
      },
    }),
    [customerName, address, cartItems, failAt, autoAck],
  );

  const run = useOrderRun("home", scenario);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [eventTimes, setEventTimes] = useState<string[]>([]);
  const [clockNow, setClockNow] = useState(() => performance.now());
  const [failOpen, setFailOpen] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);
  const failRef = useRef<HTMLDivElement>(null);
  const prevEventCount = useRef(0);

  // Track event timestamps as new events arrive
  useEffect(() => {
    if (run.events.length > prevEventCount.current) {
      const newTimes = Array.from(
        { length: run.events.length - prevEventCount.current },
        () => formatEventTime(),
      );
      setEventTimes((prev) => [...prev, ...newTimes]);
    }
    prevEventCount.current = run.events.length;
  }, [run.events.length]);


  // close fail dropdown on outside click / Esc
  useEffect(() => {
    if (!failOpen) return;
    const onDown = (e: MouseEvent) => {
      if (failRef.current && !failRef.current.contains(e.target as Node)) {
        setFailOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFailOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [failOpen]);

  // live elapsed ticker
  useEffect(() => {
    if (!startedAt || run.doneStatus) return;
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(t);
  }, [startedAt, run.doneStatus]);

  // event feed autoscroll
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [run.events]);

  // countdown clock for auto-resume
  useEffect(() => {
    if (run.autoResumeAt === null) return;
    const t = window.setInterval(() => setClockNow(performance.now()), 50);
    return () => window.clearInterval(t);
  }, [run.autoResumeAt]);

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
    setEventTimes([]);
    prevEventCount.current = 0;
    setElapsed(0);
    setStartedAt(Date.now());
    await run.start();
  };

  const resetOrder = () => {
    run.reset("user-reset");
    setStartedAt(null);
    setElapsed(0);
    setEventTimes([]);
    prevEventCount.current = 0;
  };

  // Convenience aliases
  const { running, orderId, runId, events, stepState, compensations, doneStatus, waitingOn, autoResumeAt, resumeToast, error } = run;

  const phase = getDemoPhase({ running, waitingOn, doneStatus, error });
  const countdownLabel = formatCountdown(
    autoResumeAt === null ? null : autoResumeAt - clockNow,
  );
  const scenarioChips = [
    `fail:${failAt ?? "none"}`,
    `autoAck:${autoAck ? "on" : "manual"}`,
  ];

  useEffect(() => {
    console.info("[home-demo] phase", {
      phase,
      runId,
      orderId,
      eventCount: events.length,
      countdownLabel,
    });
  }, [phase, runId, orderId, events.length, countdownLabel]);

  useEffect(() => {
    console.info("[home-demo] ui_state", {
      running,
      orderId,
      runId,
      waitingOn,
      doneStatus,
      eventCount: events.length,
      hasError: Boolean(error),
    });
  }, [running, orderId, runId, waitingOn, doneStatus, events.length, error]);

  const phoneView: "menu" | "tracking" = orderId ? "tracking" : "menu";

  const fmtElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const dec = Math.floor((ms % 1000) / 100);
    return `${s}.${dec}s`;
  };

  return (
    <div className={`h-screen overflow-hidden bg-black text-white ${geist.className}`}>
      {/* fixed nav to slides */}
      <Link
        href="/slides/title"
        className="fixed bottom-6 left-8 z-50 flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/80 px-5 py-2 font-mono text-lg text-zinc-400 backdrop-blur transition-colors hover:bg-white/10 hover:text-white"
      >
        Slides &rarr;
      </Link>
      <div className="mx-auto flex h-full max-w-[1920px] flex-col gap-16 p-12 xl:flex-row">
        {/* ──────────────────────────── LEFT: PHONE ──────────────────────────── */}
        <div className="flex shrink-0 justify-center overflow-y-auto overscroll-contain">
          <div className="relative h-[1120px] w-[560px] overflow-hidden rounded-[56px] border-[14px] border-zinc-900 bg-white text-black shadow-[0_60px_120px_-20px_rgba(0,0,0,0.8)]">
            {/* dynamic island */}
            <div className="absolute left-1/2 top-3 z-20 h-9 w-48 -translate-x-1/2 rounded-full bg-black" />

            {/* status bar */}
            <div className="flex h-16 items-center justify-between px-10 pt-4 text-lg font-medium">
              <span>9:41</span>
              <span className="flex items-center gap-2">
                <span>●●●●</span>
                <span>100%</span>
              </span>
            </div>

            {phoneView === "menu" && (
              <div className="flex h-[calc(100%-4rem)] flex-col">
                <div className="flex items-center gap-3 border-b border-zinc-100 px-10 py-6">
                  <TriangleMark size={26} className="text-black" />
                  <span className="text-2xl font-semibold tracking-tight">Triangle Donuts</span>
                </div>

                <div className="flex-1 overflow-y-auto px-10 py-8">
                  <h2 className="mb-2 text-4xl font-semibold tracking-tight">Fresh today</h2>
                  <p className="mb-8 text-xl text-zinc-500">Built at the edge. Delivered warm.</p>

                  <div className="flex flex-col divide-y divide-zinc-100">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-6">
                        <div className="flex-1 pr-6">
                          <div className="text-2xl font-semibold">{item.name}</div>
                          <div className="mt-1 text-lg text-zinc-500">{item.desc}</div>
                          <div className="mt-2 text-xl font-medium text-zinc-900">
                            ${item.price.toFixed(2)}
                          </div>
                        </div>
                        {item.qty === 0 ? (
                          <button
                            onClick={() => inc(item.id)}
                            className="h-14 w-14 rounded-full border border-zinc-200 text-3xl font-light transition-colors hover:border-black hover:bg-black hover:text-white"
                            aria-label={`add ${item.name}`}
                          >
                            +
                          </button>
                        ) : (
                          <div className="flex items-center gap-4 rounded-full border border-zinc-200 px-3 py-1">
                            <button
                              onClick={() => dec(item.id)}
                              className="h-10 w-10 text-2xl font-light"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-xl font-semibold">
                              {item.qty}
                            </span>
                            <button
                              onClick={() => inc(item.id)}
                              className="h-10 w-10 text-2xl font-light"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-10 flex flex-col gap-4">
                    <label className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Name
                    </label>
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-xl outline-none focus:border-black"
                    />
                    <label className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Deliver to
                    </label>
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-xl outline-none focus:border-black"
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-100 bg-white px-10 pb-12 pt-6">
                  <div className="mb-4 flex items-baseline justify-between text-xl">
                    <span className="text-zinc-500">
                      Subtotal · {cartItems.reduce((s, i) => s + i.qty, 0)} items
                    </span>
                    <span className="font-semibold">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="mb-6 flex items-baseline justify-between text-xl">
                    <span className="text-zinc-500">Delivery</span>
                    <span className="font-semibold">${fee.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={placeOrder}
                    disabled={cartItems.length === 0 || running}
                    className="flex w-full items-center justify-between rounded-2xl bg-black px-8 py-6 text-2xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <span>Place order</span>
                    <span>${total.toFixed(2)}</span>
                  </button>
                </div>
              </div>
            )}

            {phoneView === "tracking" && (
              <div className="flex h-[calc(100%-4rem)] flex-col">
                <div className="flex items-center gap-3 border-b border-zinc-100 px-10 py-6">
                  <TriangleMark size={26} className="text-black" />
                  <span className="text-2xl font-semibold tracking-tight">Your order</span>
                </div>

                <div className="flex-1 overflow-y-auto px-10 py-8">
                  <div className="mb-2 text-lg font-medium uppercase tracking-[0.2em] text-zinc-500">
                    {doneStatus === "completed"
                      ? "Delivered"
                      : doneStatus === "rolled_back"
                        ? "Refunded"
                        : "In progress"}
                  </div>
                  <h2 className="mb-2 text-5xl font-semibold leading-none tracking-tight">
                    {doneStatus === "completed"
                      ? "Enjoy your donuts."
                      : doneStatus === "rolled_back"
                        ? "Something went wrong."
                        : "Heading your way"}
                  </h2>
                  <p className={`text-xl text-zinc-500 ${geistMono.className}`}>{orderId}</p>

                  <div className="mt-10 flex flex-col gap-0">
                    {STEPS.map((s, i) => {
                      const state = stepState[s.id] ?? "pending";
                      const isLast = i === STEPS.length - 1;
                      const dotBase =
                        "h-14 w-14 shrink-0 rounded-full border-2 flex items-center justify-center text-xl font-semibold";
                      const dot =
                        state === "success"
                          ? "border-black bg-black text-white"
                          : state === "running"
                            ? "border-black bg-white text-black animate-pulse"
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
                        <div key={s.id} className="flex items-start gap-6">
                          <div className="flex flex-col items-center">
                            <div className={`${dotBase} ${dot}`}>
                              {state === "success" ? "✓" : state === "failed" ? "!" : i + 1}
                            </div>
                            {!isLast && <div className={`w-[2px] flex-1 min-h-[56px] ${line}`} />}
                          </div>
                          <div className="flex-1 pb-10 pt-3">
                            <div className="text-2xl font-semibold">{s.label}</div>
                            <div className="mt-1 text-lg text-zinc-500">{s.sub}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-zinc-100 bg-white px-10 pb-12 pt-6">
                  <button
                    onClick={resetOrder}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-8 py-5 text-xl font-semibold text-zinc-700 transition-colors hover:border-black hover:text-black"
                  >
                    Place another order
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ──────────────────────────── RIGHT: DASHBOARD ──────────────────────────── */}
        <div className="flex-1 space-y-10 overflow-y-auto overscroll-contain">
          {/* deployment-card-style header */}
          <section className="rounded-2xl border border-white/10 bg-zinc-950 p-10">
            <div className="flex flex-wrap items-start justify-between gap-8">
              <div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Current run
                  </div>
                  <SlideHotspot
                    href="/slides/directives"
                    label="Directives"
                    active={running || !!doneStatus}
                    color="emerald"
                  />
                </div>
                <h1 className="mt-3 text-6xl font-semibold tracking-tight">
                  {doneStatus === "completed"
                    ? "Delivered"
                    : doneStatus === "rolled_back"
                      ? "Rolled back"
                      : running
                        ? "Orchestrating…"
                        : "Ready to dispatch"}
                </h1>
                <div className={`mt-4 flex items-center gap-6 text-xl text-zinc-400 ${geistMono.className}`}>
                  <span>{orderId ?? "—"}</span>
                  <span className="text-zinc-700">•</span>
                  <span>run {runId ?? "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-10">
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-zinc-500">Elapsed</div>
                  <div className={`mt-2 text-4xl font-semibold ${geistMono.className}`}>
                    {fmtElapsed(elapsed)}
                  </div>
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-zinc-500">Steps</div>
                  <div className={`mt-2 text-4xl font-semibold ${geistMono.className}`}>
                    {Object.values(stepState).filter((s) => s === "success").length}/{STEPS.length}
                  </div>
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-zinc-500">Comps</div>
                  <div className={`mt-2 text-4xl font-semibold ${compensations.length ? "text-fuchsia-400" : ""} ${geistMono.className}`}>
                    {compensations.length}
                  </div>
                </div>
              </div>
            </div>

            {/* horizontal step timeline */}
            <div className="mt-12 pb-2">
              <div className="relative flex items-start gap-0">
                {STEPS.map((s, i) => {
                  const state = stepState[s.id] ?? "pending";
                  const isLast = i === STEPS.length - 1;

                  const nodeBase =
                    "relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 text-2xl font-semibold transition-colors";
                  const nodeStyle =
                    state === "success"
                      ? "bg-white border-white text-black"
                      : state === "running"
                        ? "border-sky-400 text-sky-300"
                        : state === "waiting"
                          ? "border-amber-400 text-amber-300"
                          : state === "failed"
                            ? "border-red-500 bg-red-500/10 text-red-400"
                            : state === "skipped"
                              ? "border-zinc-800 bg-zinc-900 text-zinc-600"
                              : "border-white/15 text-zinc-600";

                  const lineColor =
                    state === "success" ? "bg-white" : "bg-white/10";

                  return (
                    <div key={s.id} className="flex flex-1 min-w-0 flex-col items-center">
                      <div className="flex w-full items-center">
                        <div className={`h-[2px] flex-1 ${i === 0 ? "opacity-0" : lineColor}`} />
                        <div className={`${nodeBase} ${nodeStyle}`}>
                          {state === "success" ? (
                            <TriangleMark size={24} className="text-black" />
                          ) : state === "failed" ? (
                            "!"
                          ) : state === "running" ? (
                            <span className="animate-pulse">●</span>
                          ) : state === "waiting" ? (
                            "II"
                          ) : (
                            i + 1
                          )}
                        </div>
                        <div className={`h-[2px] flex-1 ${isLast ? "opacity-0" : lineColor}`} />
                      </div>
                      <div className="mt-3 w-full px-1 text-center">
                        <div className="text-lg font-semibold tracking-tight">{s.label}</div>
                        <div className={`mt-1 text-sm uppercase tracking-wider ${geistMono.className} text-zinc-500`}>
                          {state}
                        </div>
                        {s.id === "chargePayment" && (
                          <div className="mt-2 flex justify-center">
                            <SlideHotspot
                              href="/slides/idempotency"
                              label="Idempotency"
                              active={state === "success"}
                              color="sky"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* phase card + scenario fingerprint */}
          <div className={`rounded-2xl border p-4 backdrop-blur ${phaseCardClass(phase)}`}>
            <div className="flex flex-wrap gap-2">
              {scenarioChips.map((chip) => (
                <span
                  key={chip}
                  className={`rounded-full border border-white/10 bg-black/20 px-3 py-1 font-mono text-xs text-zinc-200 ${geistMono.className}`}
                >
                  {chip}
                </span>
              ))}
            </div>
            <div className="mt-4 text-sm font-semibold uppercase tracking-[0.2em]">
              {phase === "idle" && "Ready"}
              {phase === "running" && "Streaming live"}
              {phase === "waiting" && `Paused at ${waitingOn}`}
              {phase === "completed" && "Workflow completed"}
              {phase === "rolled_back" && "Workflow rolled back"}
              {phase === "error" && "Connection issue"}
            </div>
            <div className="mt-2 text-base text-zinc-300">
              {phase === "idle" && "Press Place order to run the real workflow."}
              {phase === "running" && `${events.length} events received in ${fmtElapsed(elapsed)}`}
              {phase === "waiting" &&
                (autoAck
                  ? `Auto-resume in ${countdownLabel}`
                  : "Resume from the hook controls below.")}
              {phase === "completed" && `Run ${runId ?? "—"} finished successfully.`}
              {phase === "rolled_back" &&
                (compensations.length > 0
                  ? `Compensations: ${compensations.join(" → ")}`
                  : "Rollback completed.")}
              {phase === "error" && error}
            </div>
            {resumeToast ? (
              <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">
                {resumeToast}
              </div>
            ) : null}
          </div>

          {/* controls row */}
          <section className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-10">
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Scenario
                </div>
                <SlideHotspot
                  href="/slides/naive"
                  label="The naive version"
                  active={failAt !== null}
                  color="red"
                />
              </div>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight">
                Simulate failure or retry
              </h3>
              <p className="mt-2 text-lg text-zinc-500">
                Force a fatal step or a one-time payment rate limit so the next slide explains
                something the audience just watched.
              </p>
              <div ref={failRef} className="relative mt-6">
                <button
                  type="button"
                  onClick={() => setFailOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={failOpen}
                  className={`flex w-full items-center justify-between rounded-xl border bg-black px-6 py-5 text-left text-xl transition-colors ${
                    failOpen
                      ? "border-white"
                      : failAt
                        ? "border-red-500/40 hover:border-red-500/70"
                        : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <span className="flex items-center gap-4">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        failAt ? "bg-red-500" : "bg-emerald-500"
                      }`}
                    />
                    <span className="text-zinc-500 text-sm uppercase tracking-[0.2em]">
                      Fail at
                    </span>
                    <span className={`${geistMono.className} text-white`}>
                      {failAt ?? "— none —"}
                    </span>
                  </span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    className={`shrink-0 text-zinc-400 transition-transform ${
                      failOpen ? "rotate-180" : ""
                    }`}
                  >
                    <path
                      d="M5 8l5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {failOpen && (
                  <div
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-30 mt-3 overflow-hidden rounded-xl border border-white/15 bg-zinc-950 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
                  >
                    <ul className="max-h-[480px] overflow-y-auto py-2">
                      {FAIL_OPTIONS.map((opt) => {
                        const selected = (failAt ?? null) === (opt.value ?? null);
                        const isHappy = opt.value === null;
                        return (
                          <li key={String(opt.value)}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => {
                                setFailAt(opt.value);
                                setFailOpen(false);
                              }}
                              className={`group flex w-full items-center gap-5 px-6 py-4 text-left text-lg transition-colors hover:bg-white/5 ${
                                selected ? "bg-white/[0.04]" : ""
                              }`}
                            >
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                  isHappy ? "bg-emerald-500" : "bg-red-500/70"
                                }`}
                              />
                              <span className="flex flex-1 items-baseline gap-3">
                                <span
                                  className={`${geistMono.className} ${
                                    selected ? "text-white" : "text-zinc-300"
                                  }`}
                                >
                                  {opt.value ?? "null"}
                                </span>
                                <span className="text-sm text-zinc-500">
                                  {isHappy ? "happy path" : "force failure"}
                                </span>
                              </span>
                              <span
                                className={`flex h-6 w-6 items-center justify-center text-white transition-opacity ${
                                  selected ? "opacity-100" : "opacity-0"
                                }`}
                              >
                                <svg width="18" height="18" viewBox="0 0 20 20">
                                  <path
                                    d="M4 10l4 4 8-9"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="border-t border-white/10 bg-black/40 px-6 py-3 text-sm text-zinc-500">
                      <kbd className="rounded bg-white/10 px-2 py-0.5">Esc</kbd> to close
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-10">
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Hooks
                </div>
                <SlideHotspot
                  href="/slides/hooks"
                  label="Pause. Wait. Resume."
                  active={waitingOn !== null}
                  color="amber"
                />
              </div>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight">Auto-resume</h3>
              <p className="mt-2 text-lg text-zinc-500">
                When enabled, paused steps auto-acknowledge after 800ms so the run completes end-to-end.
              </p>
              <label className="mt-6 flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-black px-6 py-5">
                <span className="text-xl">Automatic hook resolution</span>
                <span
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${
                    autoAck ? "bg-white" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-black transition-transform ${
                      autoAck ? "translate-x-9" : "translate-x-1"
                    }`}
                  />
                </span>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={autoAck}
                  onChange={(e) => setAutoAck(e.target.checked)}
                />
              </label>

              {waitingOn && autoAck && autoResumeAt !== null && (
                <div className="mt-6 overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center justify-between gap-6 px-6 py-5">
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
                        Pause made visible
                      </div>
                      <div className="mt-2 text-2xl font-semibold">{waitingOn}</div>
                      <div className="mt-1 text-base text-zinc-400">
                        Auto-resume is scheduled so the audience can feel the pause before the workflow
                        wakes back up.
                      </div>
                    </div>
                    <div
                      className={`rounded-full border border-amber-400/40 bg-black px-4 py-2 text-xl text-amber-200 ${geistMono.className}`}
                    >
                      {Math.max(0, (autoResumeAt - clockNow) / 1000).toFixed(1)}s
                    </div>
                  </div>
                  <div
                    className="h-1 bg-amber-400/80 transition-[width] duration-75"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, ((autoResumeAt - clockNow) / 800) * 100),
                      )}%`,
                    }}
                  />
                </div>
              )}

              {resumeToast && (
                <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 text-lg text-emerald-200 transition-all duration-300">
                  {resumeToast}
                </div>
              )}

              {/* manual hook controls — visible when waiting & autoAck off */}
              {waitingOn && !autoAck && (
                <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
                    Awaiting manual resolution
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{waitingOn}</div>
                  <div className="mt-5 flex flex-wrap gap-4">
                    {waitingOn === "notifyRestaurant" && (
                      <>
                        <button
                          onClick={() => void run.resume({ kind: "restaurant-accept", accepted: true })}
                          className="rounded-xl bg-white px-6 py-4 text-lg font-semibold text-black hover:opacity-90"
                        >
                          Restaurant accept
                        </button>
                        <button
                          onClick={() =>
                            void run.resume({ kind: "restaurant-accept", accepted: false, reason: "closed" })
                          }
                          className="rounded-xl border border-red-500/40 px-6 py-4 text-lg font-semibold text-red-400 hover:bg-red-500/10"
                        >
                          Restaurant reject
                        </button>
                      </>
                    )}
                    {waitingOn === "assignDriver" && (
                      <>
                        <button
                          onClick={() => void run.resume({ kind: "driver-accept", accepted: true })}
                          className="rounded-xl bg-white px-6 py-4 text-lg font-semibold text-black hover:opacity-90"
                        >
                          Driver accept
                        </button>
                        <button
                          onClick={() =>
                            void run.resume({ kind: "driver-accept", accepted: false })
                          }
                          className="rounded-xl border border-red-500/40 px-6 py-4 text-lg font-semibold text-red-400 hover:bg-red-500/10"
                        >
                          Driver reject
                        </button>
                      </>
                    )}
                    {waitingOn === "trackDelivery" && (
                      <button
                        onClick={() => void run.resume({ kind: "delivered" })}
                        className="rounded-xl bg-white px-6 py-4 text-lg font-semibold text-black hover:opacity-90"
                      >
                        Mark delivered
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* event feed */}
          <section className="rounded-2xl border border-white/10 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-white/10 px-10 py-6">
              <div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Logs
                  </div>
                  <SlideHotspot
                    href="/slides/streaming"
                    label="Streaming"
                    active={events.length > 0}
                    color="sky"
                  />
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Event stream</h3>
              </div>
              <div className={`text-lg text-zinc-500 ${geistMono.className}`}>
                {events.length} events
              </div>
            </div>
            <div
              ref={feedRef}
              className={`max-h-[520px] min-h-[260px] overflow-y-auto px-10 py-6 ${geistMono.className} text-lg leading-relaxed`}
            >
              {events.length === 0 ? (
                <div className="py-8 text-xl text-zinc-600">
                  No events yet. Place an order from the phone to start the saga.
                </div>
              ) : (
                events.map((e, i) => {
                  const { kind, msg } = formatEventLine(e);
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-6 border-b border-white/5 py-3 last:border-0"
                    >
                      <span className="shrink-0 text-zinc-600">
                        {eventTimes[i] ?? "00:00:00"}
                      </span>
                      <span className={`shrink-0 font-semibold ${kindColor(kind)}`}>{kind}</span>
                      <span className="flex-1 text-zinc-200">{msg}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* compensations */}
          <section className={`rounded-2xl border p-10 transition-all duration-500 ${
            compensations.length > 0
              ? "border-fuchsia-500/20 bg-fuchsia-500/5"
              : "border-white/10 bg-zinc-950"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`text-sm font-semibold uppercase tracking-[0.2em] ${
                compensations.length > 0 ? "text-fuchsia-300" : "text-zinc-500"
              }`}>
                Compensations
              </div>
              <SlideHotspot
                href="/slides/saga"
                label="Saga pattern"
                active={compensations.length > 0}
                color="fuchsia"
              />
            </div>
            <h3 className="mt-3 text-3xl font-semibold tracking-tight">
              {compensations.length > 0
                ? "Rollback executed in reverse order"
                : "No compensations yet"}
            </h3>
            {compensations.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-4">
                {compensations.map((c, i) => (
                  <span
                    key={i}
                    className={`rounded-full border border-fuchsia-400/40 bg-black px-6 py-3 text-xl ${geistMono.className}`}
                  >
                    {i + 1}. {c}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
