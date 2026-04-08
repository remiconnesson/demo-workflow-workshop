"use client";

import { JetBrains_Mono } from "next/font/google";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const jetbrains = JetBrains_Mono({ subsets: ["latin"] });

const MENU: OrderItem[] = [
  { id: "pho", name: "Beef Phở", price: 14, qty: 0 },
  { id: "banh", name: "Bánh Mì", price: 10, qty: 0 },
  { id: "spring", name: "Spring Rolls (4)", price: 8, qty: 0 },
  { id: "boba", name: "Taro Boba", price: 6, qty: 0 },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "VALIDATE_ORDER" },
  { key: "chargePayment", label: "CHARGE_PAYMENT" },
  { key: "notifyRestaurant", label: "NOTIFY_RESTAURANT" },
  { key: "assignDriver", label: "ASSIGN_DRIVER" },
  { key: "trackDelivery", label: "TRACK_DELIVERY" },
  { key: "sendReceipt", label: "SEND_RECEIPT" },
];

const FAIL_OPTIONS: { value: FailStep; label: string; key: string }[] = [
  { value: null, label: "HAPPY PATH", key: "0" },
  { value: "validateOrder", label: "FAIL AT VALIDATE", key: "1" },
  { value: "chargePayment", label: "FAIL AT PAYMENT", key: "2" },
  { value: "notifyRestaurant", label: "FAIL AT RESTAURANT", key: "3" },
  { value: "assignDriver", label: "FAIL AT DRIVER", key: "4" },
  { value: "trackDelivery", label: "FAIL AT DELIVERY", key: "5" },
  { value: "sendReceipt", label: "FAIL AT RECEIPT", key: "6" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

export default function TerminalPage() {
  const [cart, setCart] = useState<OrderItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "pho" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("ADA LOVELACE");
  const [address, setAddress] = useState("123 CUPCAKE LN, SF");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<{ msg: string; type: string }[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  const [blink, setBlink] = useState(true);
  const [command, setCommand] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => setBlink((b) => !b), 500);
    return () => clearInterval(interval);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setEvents([]);
    setStepStatuses({});
    setResult(null);
    setCompensations([]);
    setCurrentOrderId(null);
    setCommand("");
    addLog("SYSTEM RESET INITIATED", "warn");
  }, []);

  const addLog = (msg: string, type: string = "info") => {
    setEvents((ev) => [...ev, { msg: msg.toUpperCase(), type }]);
  };

  const applyEvent = (event: OrderEvent) => {
    switch (event.type) {
      case "step_running":
        setStepStatuses((s) => ({ ...s, [event.step]: "running" }));
        addLog(`RUNNING: ${event.label}`, "info");
        break;
      case "step_succeeded":
        setStepStatuses((s) => ({ ...s, [event.step]: "success" }));
        addLog(`SUCCESS: ${event.label} - ${event.detail ?? "OK"}`, "success");
        break;
      case "step_failed":
        setStepStatuses((s) => ({ ...s, [event.step]: "failed" }));
        addLog(`FAILURE: ${event.label} - ${event.error}`, "error");
        break;
      case "step_skipped":
        setStepStatuses((s) => ({ ...s, [event.step]: "skipped" }));
        addLog(`SKIPPED: ${event.label}`, "warn");
        break;
      case "waiting_for_hook": {
        setStepStatuses((s) => ({ ...s, [event.step]: "waiting" }));
        addLog(`WAITING: ${event.label}`, "warn");
        if (autoAck) {
          const kind =
            event.step === "notifyRestaurant"
              ? ("restaurant-accept" as const)
              : event.step === "assignDriver"
                ? ("driver-accept" as const)
                : ("delivered" as const);
          setTimeout(() => {
            void resume(kind, kind === "delivered" ? {} : { accepted: true });
          }, 1200);
        }
        break;
      }
      case "hook_resolved":
        setStepStatuses((s) => ({ ...s, [event.step]: "success" }));
        addLog(`RESOLVED: ${event.step} - ${event.detail}`, "success");
        break;
      case "compensated":
        setCompensations((c) => [...c, event.action]);
        addLog(`COMPENSATED: ${event.action}`, "error");
        break;
      case "done":
        setResult(event.status);
        addLog(`FINAL STATUS: ${event.status}`, event.status === "completed" ? "success" : "error");
        break;
      case "log":
        addLog(event.message, "info");
        break;
    }
  };

  const resume = async (
    kind: "restaurant-accept" | "driver-accept" | "delivered",
    payload: object = {},
  ) => {
    // Note: currentOrderId is stale in this closure if we don't use a ref, 
    // but setCurrentOrderId is called right before placeOrder starts.
    // However, in this component currentOrderId is state.
    // Let's use a ref for orderId to be safe.
    if (!orderIdRef.current) return;
    addLog(`RESUMING ${kind.toUpperCase()}...`, "warn");
    await fetch(`/api/orders/${orderIdRef.current}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  };

  const orderIdRef = useRef<string | null>(null);

  const placeOrder = useCallback(async () => {
    if (running || total === 0) return;
    reset();
    setRunning(true);

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    setCurrentOrderId(orderId);
    orderIdRef.current = orderId;

    addLog(`INITIALIZING ORDER ${orderId}`, "info");

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
      addLog(`RUN_ID: ${runId}`, "info");

      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`/api/runs/${runId}/stream`, {
        signal: controller.signal,
      });
      if (!res.body) throw new Error("STREAM ERROR");

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
          } catch { /* framing */ }
        }
      }
    } catch (e) {
      addLog(`SYSTEM INTERRUPT: ${String(e)}`, "error");
    } finally {
      setRunning(false);
      addLog("PROCESS TERMINATED", "warn");
    }
  }, [cart, customerName, address, failAt, autoAck, running, total, reset]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (e.target instanceof HTMLInputElement) return;

      if (key === "P") placeOrder();
      if (key === "R") reset();
      if (key === "A") setAutoAck((a) => !a);
      if (key === "0") setFailAt(null);
      if (key >= "1" && key <= "6") {
        const opt = FAIL_OPTIONS.find((o) => o.key === key);
        if (opt) setFailAt(opt.value);
      }
      // Manual hook triggers
      if (key === "Y") resume("restaurant-accept", { accepted: true });
      if (key === "N") resume("restaurant-accept", { accepted: false, reason: "OUT OF STOCK" });
      if (key === "U") resume("driver-accept", { accepted: true });
      if (key === "I") resume("driver-accept", { accepted: false });
      if (key === "D") resume("delivered");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [placeOrder, reset]);

  return (
    <div
      className={`${jetbrains.className} min-h-screen bg-[#0a0a0a] p-4 text-[#33ff66] selection:bg-[#33ff66] selection:text-[#0a0a0a]`}
    >
      {/* HEADER */}
      <Box className="mb-4 text-center py-1">
        V4 FOOD DELIVERY TERMINAL v1.0.0 (C) 2026 GIGA-BITS CORP - STATUS:{" "}
        <span className={running ? "animate-pulse text-[#ffb000]" : "text-[#33ff66]"}>
          {running ? "ONLINE" : "READY"}
        </span>
      </Box>

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT PANE: CONFIG */}
        <div className="col-span-12 md:col-span-4 space-y-4">
          <Box title="MENU_SELECTION">
            <div className="space-y-1">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center group">
                  <span>
                    {item.name.padEnd(16, ".")} ${item.price}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setCart((c) =>
                          c.map((i) =>
                            i.id === item.id ? { ...i, qty: Math.max(0, i.qty - 1) } : i,
                          ),
                        )
                      }
                      className="hover:bg-[#33ff66] hover:text-[#0a0a0a] px-1"
                    >
                      [-]
                    </button>
                    <span className="w-4 text-center">{item.qty}</span>
                    <button
                      onClick={() =>
                        setCart((c) =>
                          c.map((i) =>
                            i.id === item.id ? { ...i, qty: i.qty + 1 } : i,
                          ),
                        )
                      }
                      className="hover:bg-[#33ff66] hover:text-[#0a0a0a] px-1"
                    >
                      [+]
                    </button>
                  </div>
                </div>
              ))}
              <div className="border-t border-dashed border-[#33ff66] mt-2 pt-2 flex justify-between">
                <span>TOTAL_ITEMS: {totalItems}</span>
                <span className="text-[#ffb000]">${total.toFixed(2)}</span>
              </div>
            </div>
          </Box>

          <Box title="USER_DAT">
            <div className="space-y-2">
              <div>
                <div className="text-xs opacity-70">CUSTOMER_NAME:</div>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                  className="w-full bg-transparent border-none outline-none text-[#ffb000]"
                />
              </div>
              <div>
                <div className="text-xs opacity-70">DELIVERY_ADDR:</div>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value.toUpperCase())}
                  className="w-full bg-transparent border-none outline-none text-[#ffb000]"
                />
              </div>
            </div>
          </Box>

          <Box title="DEMO_PARAMS">
            <div className="space-y-1">
              <div className="text-xs opacity-70 mb-1">FAIL_SCENARIO:</div>
              {FAIL_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFailAt(opt.value)}
                  className={`block w-full text-left px-2 ${
                    failAt === opt.value ? "bg-[#33ff66] text-[#0a0a0a]" : "hover:opacity-80"
                  }`}
                >
                  [{opt.key}] {opt.label}
                </button>
              ))}
              <div className="mt-3">
                <button
                  onClick={() => setAutoAck((a) => !a)}
                  className={`flex gap-2 items-center w-full px-2 ${
                    autoAck ? "text-[#33ff66]" : "text-[#ff4a3d]"
                  }`}
                >
                  [{autoAck ? "X" : " "}] AUTO_ACK_ENABLED [A]
                </button>
              </div>
            </div>
          </Box>
        </div>

        {/* MIDDLE PANE: SAGA HTOP */}
        <div className="col-span-12 md:col-span-5">
          <Box title="SAGA_PROCESS_MONITOR">
            <div className="w-full border-b border-[#33ff66] pb-1 mb-2 flex text-xs font-bold uppercase">
              <span className="w-1/2">SAGA_STEP</span>
              <span className="w-1/4">STATE</span>
              <span className="w-1/4">RESULT</span>
            </div>
            <div className="space-y-1">
              {STEPS.map((step) => {
                const status = stepStatuses[step.key] ?? "pending";
                return (
                  <div
                    key={step.key}
                    className={`flex items-center text-sm ${
                      status === "running" ? "bg-[#33ff66] text-[#0a0a0a] font-bold" : ""
                    }`}
                  >
                    <span className="w-1/2">
                      {status === "running" ? "> " : "  "}
                      {step.label}
                    </span>
                    <span className={`w-1/4 ${statusColor(status)}`}>
                      {status.toUpperCase()}
                    </span>
                    <span className="w-1/4 opacity-80">
                      {status === "success" ? "OK" : status === "failed" ? "ERR" : "---"}
                    </span>
                  </div>
                );
              })}
            </div>

            {compensations.length > 0 && (
              <div className="mt-6 border-t border-dashed border-[#ff4a3d] pt-2">
                <div className="text-[#ff4a3d] font-bold mb-1 underline">ROLLBACK_ACTIONS_FIRED:</div>
                {compensations.map((c, i) => (
                  <div key={i} className="text-[#ff4a3d] text-xs">
                    * REVERSING {c.toUpperCase()}... COMPLETE
                  </div>
                ))}
              </div>
            )}

            {result && (
              <div className={`mt-4 p-2 text-center border-2 ${
                result === "completed" ? "border-[#33ff66] text-[#33ff66]" : "border-[#ff4a3d] text-[#ff4a3d]"
              }`}>
                {result === "completed" ? "SAGA_COMPLETED_SUCCESSFULLY" : "SAGA_EXECUTION_FAILED_ROLLBACK_OK"}
              </div>
            )}
          </Box>
        </div>

        {/* RIGHT PANE: HOOKS & RESULT */}
        <div className="col-span-12 md:col-span-3 space-y-4">
          <Box title="HOOK_MANUAL_OVR">
            <div className="space-y-2">
              <HookButton cmd="[Y]" label="REST_ACCEPT" onClick={() => resume("restaurant-accept", { accepted: true })} />
              <HookButton cmd="[N]" label="REST_REJECT" onClick={() => resume("restaurant-accept", { accepted: false, reason: "OUT" })} color="#ff4a3d" />
              <HookButton cmd="[U]" label="DRIV_ACCEPT" onClick={() => resume("driver-accept", { accepted: true })} />
              <HookButton cmd="[I]" label="DRIV_REJECT" onClick={() => resume("driver-accept", { accepted: false })} color="#ff4a3d" />
              <HookButton cmd="[D]" label="MARK_DELIV" onClick={() => resume("delivered")} />
            </div>
            <p className="text-[10px] mt-4 opacity-50">
              * ONLY ACTIVE WHEN AUTO_ACK IS DISABLED
            </p>
          </Box>

          <Box title="ORDER_INFO">
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="opacity-50">ID:</span>
                <span className="text-[#ffb000]">{currentOrderId ?? "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-50">ITEMS:</span>
                <span>{totalItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-50">TOTAL:</span>
                <span className="text-[#ffb000]">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-50">AUTO:</span>
                <span>{autoAck ? "YES" : "NO"}</span>
              </div>
            </div>
          </Box>
        </div>
      </div>

      {/* FOOTER: LOG & PROMPT */}
      <Box title="SYSTEM_EVENT_LOG" className="mt-4">
        <div
          ref={logRef}
          className="h-48 overflow-y-auto font-mono text-[11px] space-y-0.5"
        >
          {events.length === 0 ? (
            <div className="opacity-30 italic">LISTENING FOR SYSTEM EVENTS...</div>
          ) : (
            events.map((ev, i) => (
              <div key={i}>
                <span className="opacity-40">[{new Date().toLocaleTimeString()}]</span>{" "}
                <span className={logTypeColor(ev.type)}>{ev.msg}</span>
              </div>
            ))
          )}
        </div>
      </Box>

      <div className="mt-4 grid grid-cols-12 gap-4 text-xs font-bold">
        <div className="col-span-12 md:col-span-8">
          <Box className="h-full">
            <div className="flex items-center">
              <span className="mr-2 text-[#ffb000]">ADA@SAGA-TERMINAL:~$</span>
              <span>{command}</span>
              {blink && <span className="w-2 h-4 bg-[#33ff66] ml-1 animate-pulse" />}
            </div>
          </Box>
        </div>
        <div className="col-span-12 md:col-span-2">
          <button
            onClick={placeOrder}
            disabled={running || total === 0}
            className="w-full h-full border-2 border-[#33ff66] px-4 py-2 hover:bg-[#33ff66] hover:text-[#0a0a0a] disabled:opacity-30 flex items-center justify-center"
          >
            [P]LACE_ORDER
          </button>
        </div>
        <div className="col-span-12 md:col-span-2">
          <button
            onClick={reset}
            className="w-full h-full border-2 border-[#ff4a3d] text-[#ff4a3d] px-4 py-2 hover:bg-[#ff4a3d] hover:text-[#0a0a0a] flex items-center justify-center"
          >
            [R]ESET
          </button>
        </div>
      </div>

      <div className="mt-2 text-[10px] opacity-40 flex gap-4 justify-center">
        <span>[P] EXECUTE</span>
        <span>[R] REBOOT</span>
        <span>[A] AUTO_ACK</span>
        <span>[0-6] FAIL_CFG</span>
        <span>[Y/N/U/I/D] HOOK_CTRL</span>
      </div>
    </div>
  );
}

function Box({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const line = "════════════════════════════════════════════════════════════════════════════════════════════════════";
  const sides = "║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║\n║";
  
  return (
    <div className={`flex flex-col ${className}`}>
      {/* Top border */}
      <div className="flex text-[#33ff66] text-[12px] leading-none overflow-hidden whitespace-nowrap select-none">
        <span>╔</span>
        {title ? (
          <>
            <span className="px-1">══[ {title} ]══</span>
            <span className="flex-1 overflow-hidden">{line}</span>
          </>
        ) : (
          <span className="flex-1 overflow-hidden">{line}</span>
        )}
        <span>╗</span>
      </div>

      {/* Content with side borders */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <pre className="text-[#33ff66] px-[0.5ch] select-none leading-[1.2] text-[12px] overflow-hidden">
          {sides}
        </pre>
        <div className="flex-1 p-2 min-w-0">{children}</div>
        <pre className="text-[#33ff66] px-[0.5ch] select-none leading-[1.2] text-[12px] overflow-hidden">
          {sides}
        </pre>
      </div>

      {/* Bottom border */}
      <div className="flex text-[#33ff66] text-[12px] leading-none overflow-hidden whitespace-nowrap select-none">
        <span>╚</span>
        <span className="flex-1 overflow-hidden">{line}</span>
        <span>╝</span>
      </div>
    </div>
  );
}

function HookButton({
  cmd,
  label,
  onClick,
  color = "#33ff66",
}: {
  cmd: string;
  label: string;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-dashed border-[#33ff66] px-2 py-1 hover:bg-[#33ff66] hover:text-[#0a0a0a] text-xs transition-colors"
      style={{ borderColor: color, color: color }}
    >
      <span className="font-bold mr-2">{cmd}</span>
      {label}
    </button>
  );
}

function statusColor(s: StepStatus) {
  switch (s) {
    case "running":
      return "text-[#0a0a0a]"; // because it has green bg
    case "success":
      return "text-[#33ff66]";
    case "failed":
      return "text-[#ff4a3d]";
    case "waiting":
      return "text-[#ffb000]";
    default:
      return "opacity-30";
  }
}

function logTypeColor(type: string) {
  switch (type) {
    case "success":
      return "text-[#33ff66]";
    case "error":
      return "text-[#ff4a3d]";
    case "warn":
      return "text-[#ffb000]";
    default:
      return "text-[#33ff66] opacity-80";
  }
}
