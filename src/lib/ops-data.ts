/**
 * Shared in-memory ops data store for the workshop's AI-agent demos.
 *
 * This module is intentionally process-local (module-scope Maps / arrays).
 * It's consumed by both the Observer agent (autonomous, writes reports) and
 * the Analyst agent (interactive, proposes menu changes). No DB, no
 * persistence — perfect for a stage demo that resets on server restart.
 */

export type Scenario = "happy" | "payment-retry" | "slow-restaurant" | "driver-refuses";

export type OrderOutcome = "delivered" | "refunded" | "cancelled";

export type OrderItem = {
  sku: string;
  name: string;
  price: number;
};

export type OrderRecord = {
  id: string;
  timestamp: string; // ISO string
  scenario: Scenario;
  outcome: OrderOutcome;
  waitMs: number;
  retries: number;
  compensationsFired: number;
  restaurantId: string;
  items: OrderItem[];
};

export type MenuItem = {
  sku: string;
  name: string;
  price: number;
  availableAfter?: string; // e.g. "11:00"
  availableBefore?: string; // e.g. "23:00"
  hidden?: boolean;
};

export type ReportEntry = {
  at: string; // ISO timestamp
  kind: "metric" | "flag" | "summary";
  text: string;
  data?: Record<string, unknown>;
};

export type MenuProposal = {
  id: string;
  at: string;
  sku: string;
  patch: Partial<MenuItem>;
  rationale: string;
  status: "pending" | "approved" | "rejected" | "applied" | "rolled_back";
};

// ---------------------------------------------------------------------------
// Module-scope state
// ---------------------------------------------------------------------------

const orders: OrderRecord[] = [];
const menu = new Map<string, MenuItem>();
const menuHistory = new Map<string, MenuItem[]>(); // sku -> stack of prior versions
const report: ReportEntry[] = [];
const proposals = new Map<string, MenuProposal>();

let seeded = false;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const SEED_MENU: MenuItem[] = [
  { sku: "burger-classic", name: "Classic Burger", price: 12.5 },
  { sku: "burger-double", name: "Double Stack Burger", price: 15.0 },
  { sku: "pho-beef", name: "Beef Pho", price: 14.0 },
  { sku: "sushi-omakase", name: "Omakase Plate", price: 32.0 },
  { sku: "salad-caesar", name: "Caesar Salad", price: 10.0 },
  { sku: "pizza-marg", name: "Margherita Pizza", price: 16.5 },
  { sku: "tacos-al-pastor", name: "Al Pastor Tacos (3)", price: 11.0 },
  { sku: "ramen-tonkotsu", name: "Tonkotsu Ramen", price: 15.5 },
];

// Deterministic seed — indexed arrays are easier than RNG here.
const SEED_ORDERS: Array<Omit<OrderRecord, "id" | "timestamp">> = [
  // Happy path
  { scenario: "happy", outcome: "delivered", waitMs: 1800, retries: 0, compensationsFired: 0, restaurantId: "r-burger-barn", items: [{ sku: "burger-classic", name: "Classic Burger", price: 12.5 }] },
  { scenario: "happy", outcome: "delivered", waitMs: 2100, retries: 0, compensationsFired: 0, restaurantId: "r-pho-house", items: [{ sku: "pho-beef", name: "Beef Pho", price: 14.0 }] },
  { scenario: "happy", outcome: "delivered", waitMs: 1500, retries: 0, compensationsFired: 0, restaurantId: "r-pizza-ovn", items: [{ sku: "pizza-marg", name: "Margherita Pizza", price: 16.5 }] },
  { scenario: "happy", outcome: "delivered", waitMs: 1950, retries: 0, compensationsFired: 0, restaurantId: "r-taco-truck", items: [{ sku: "tacos-al-pastor", name: "Al Pastor Tacos (3)", price: 11.0 }] },
  { scenario: "happy", outcome: "delivered", waitMs: 2400, retries: 0, compensationsFired: 0, restaurantId: "r-ramen-yatai", items: [{ sku: "ramen-tonkotsu", name: "Tonkotsu Ramen", price: 15.5 }] },
  { scenario: "happy", outcome: "delivered", waitMs: 2050, retries: 0, compensationsFired: 0, restaurantId: "r-burger-barn", items: [{ sku: "burger-double", name: "Double Stack Burger", price: 15.0 }] },
  { scenario: "happy", outcome: "delivered", waitMs: 1700, retries: 0, compensationsFired: 0, restaurantId: "r-salad-bar", items: [{ sku: "salad-caesar", name: "Caesar Salad", price: 10.0 }] },
  { scenario: "happy", outcome: "delivered", waitMs: 2200, retries: 0, compensationsFired: 0, restaurantId: "r-sushi-zen", items: [{ sku: "sushi-omakase", name: "Omakase Plate", price: 32.0 }] },
  // Payment retry (eventually delivered after transient retries)
  { scenario: "payment-retry", outcome: "delivered", waitMs: 2600, retries: 2, compensationsFired: 0, restaurantId: "r-pizza-ovn", items: [{ sku: "pizza-marg", name: "Margherita Pizza", price: 16.5 }] },
  { scenario: "payment-retry", outcome: "delivered", waitMs: 2750, retries: 1, compensationsFired: 0, restaurantId: "r-burger-barn", items: [{ sku: "burger-classic", name: "Classic Burger", price: 12.5 }] },
  { scenario: "payment-retry", outcome: "delivered", waitMs: 3100, retries: 3, compensationsFired: 0, restaurantId: "r-pho-house", items: [{ sku: "pho-beef", name: "Beef Pho", price: 14.0 }] },
  { scenario: "payment-retry", outcome: "refunded", waitMs: 4200, retries: 4, compensationsFired: 1, restaurantId: "r-sushi-zen", items: [{ sku: "sushi-omakase", name: "Omakase Plate", price: 32.0 }] },
  // Slow restaurant (long waits, some timeout into cancel)
  { scenario: "slow-restaurant", outcome: "delivered", waitMs: 8600, retries: 0, compensationsFired: 0, restaurantId: "r-sushi-zen", items: [{ sku: "sushi-omakase", name: "Omakase Plate", price: 32.0 }] },
  { scenario: "slow-restaurant", outcome: "delivered", waitMs: 9200, retries: 0, compensationsFired: 0, restaurantId: "r-sushi-zen", items: [{ sku: "sushi-omakase", name: "Omakase Plate", price: 32.0 }] },
  { scenario: "slow-restaurant", outcome: "cancelled", waitMs: 12000, retries: 0, compensationsFired: 2, restaurantId: "r-sushi-zen", items: [{ sku: "sushi-omakase", name: "Omakase Plate", price: 32.0 }] },
  { scenario: "slow-restaurant", outcome: "cancelled", waitMs: 11500, retries: 0, compensationsFired: 2, restaurantId: "r-sushi-zen", items: [{ sku: "sushi-omakase", name: "Omakase Plate", price: 32.0 }] },
  { scenario: "slow-restaurant", outcome: "delivered", waitMs: 7900, retries: 0, compensationsFired: 0, restaurantId: "r-ramen-yatai", items: [{ sku: "ramen-tonkotsu", name: "Tonkotsu Ramen", price: 15.5 }] },
  { scenario: "slow-restaurant", outcome: "cancelled", waitMs: 10800, retries: 0, compensationsFired: 2, restaurantId: "r-sushi-zen", items: [{ sku: "sushi-omakase", name: "Omakase Plate", price: 32.0 }] },
  // Driver refuses (full compensation stack)
  { scenario: "driver-refuses", outcome: "refunded", waitMs: 3400, retries: 0, compensationsFired: 3, restaurantId: "r-burger-barn", items: [{ sku: "burger-double", name: "Double Stack Burger", price: 15.0 }] },
  { scenario: "driver-refuses", outcome: "refunded", waitMs: 3200, retries: 0, compensationsFired: 3, restaurantId: "r-pho-house", items: [{ sku: "pho-beef", name: "Beef Pho", price: 14.0 }] },
  { scenario: "driver-refuses", outcome: "refunded", waitMs: 2950, retries: 0, compensationsFired: 3, restaurantId: "r-pizza-ovn", items: [{ sku: "pizza-marg", name: "Margherita Pizza", price: 16.5 }] },
  { scenario: "driver-refuses", outcome: "refunded", waitMs: 3550, retries: 0, compensationsFired: 3, restaurantId: "r-taco-truck", items: [{ sku: "tacos-al-pastor", name: "Al Pastor Tacos (3)", price: 11.0 }] },
  // More happy to round out to ~25
  { scenario: "happy", outcome: "delivered", waitMs: 1850, retries: 0, compensationsFired: 0, restaurantId: "r-salad-bar", items: [{ sku: "salad-caesar", name: "Caesar Salad", price: 10.0 }] },
  { scenario: "happy", outcome: "delivered", waitMs: 2000, retries: 0, compensationsFired: 0, restaurantId: "r-taco-truck", items: [{ sku: "tacos-al-pastor", name: "Al Pastor Tacos (3)", price: 11.0 }] },
  { scenario: "happy", outcome: "delivered", waitMs: 2150, retries: 0, compensationsFired: 0, restaurantId: "r-ramen-yatai", items: [{ sku: "ramen-tonkotsu", name: "Tonkotsu Ramen", price: 15.5 }] },
];

export function seedOpsData(): void {
  if (seeded) return;
  seeded = true;

  for (const item of SEED_MENU) {
    menu.set(item.sku, { ...item });
  }

  // Anchor timestamps to a stable "now" at seed time, spaced 4 minutes apart.
  const base = Date.now();
  SEED_ORDERS.forEach((o, idx) => {
    const ts = new Date(base - (SEED_ORDERS.length - idx) * 4 * 60 * 1000).toISOString();
    orders.push({
      ...o,
      id: `ord-${String(idx + 1).padStart(4, "0")}`,
      timestamp: ts,
    });
  });
}

// Auto-seed on first import so callers don't have to remember.
seedOpsData();

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export function getRecentOrders(limit = 25): OrderRecord[] {
  return orders.slice(-limit).slice().reverse();
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export function getMenu(): MenuItem[] {
  return Array.from(menu.values()).map((m) => ({ ...m }));
}

export function mutateMenu(sku: string, patch: Partial<MenuItem>): MenuItem | null {
  const current = menu.get(sku);
  if (!current) return null;
  const history = menuHistory.get(sku) ?? [];
  history.push({ ...current });
  menuHistory.set(sku, history);
  const next: MenuItem = { ...current, ...patch, sku: current.sku };
  menu.set(sku, next);
  return { ...next };
}

export function rollbackMenuMutation(sku: string): MenuItem | null {
  const history = menuHistory.get(sku);
  if (!history || history.length === 0) return null;
  const prev = history.pop()!;
  menu.set(sku, { ...prev });
  return { ...prev };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export function appendReport(entry: ReportEntry): ReportEntry {
  const stamped: ReportEntry = { ...entry, at: entry.at ?? new Date().toISOString() };
  report.push(stamped);
  return stamped;
}

export function readReport(): ReportEntry[] {
  return report.slice();
}

// ---------------------------------------------------------------------------
// Proposals (used by Analyst agent)
// ---------------------------------------------------------------------------

export function createProposal(input: {
  sku: string;
  patch: Partial<MenuItem>;
  rationale: string;
}): MenuProposal {
  const id = `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const proposal: MenuProposal = {
    id,
    at: new Date().toISOString(),
    sku: input.sku,
    patch: input.patch,
    rationale: input.rationale,
    status: "pending",
  };
  proposals.set(id, proposal);
  return { ...proposal };
}

export function getProposal(id: string): MenuProposal | null {
  const p = proposals.get(id);
  return p ? { ...p } : null;
}

export function setProposalStatus(id: string, status: MenuProposal["status"]): MenuProposal | null {
  const p = proposals.get(id);
  if (!p) return null;
  p.status = status;
  return { ...p };
}

export function listProposals(): MenuProposal[] {
  return Array.from(proposals.values()).map((p) => ({ ...p }));
}
