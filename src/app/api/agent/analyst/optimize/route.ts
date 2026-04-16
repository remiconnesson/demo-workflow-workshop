import { generateObject } from "ai";
import { z } from "zod";

import { getMenu, getRecentOrders, readReport } from "@/lib/ops-data";

type OptimizeBody = {
  focusedSkus?: string[];
};

const schema = z.object({
  proposals: z
    .array(z.string().min(8).max(180))
    .min(3)
    .max(4),
});

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as OptimizeBody;
  const focused = Array.isArray(body.focusedSkus) ? body.focusedSkus : [];

  const menu = getMenu();
  const orders = getRecentOrders(60);
  const report = readReport();

  // Roll up order stats per sku so the model sees revenue signal, not raw rows.
  type SkuStats = {
    delivered: number;
    cancelled: number;
    refunded: number;
    totalRetries: number;
    totalCompensations: number;
  };
  const perSku = new Map<string, SkuStats>();
  for (const o of orders) {
    for (const it of o.items) {
      const s = perSku.get(it.sku) ?? {
        delivered: 0,
        cancelled: 0,
        refunded: 0,
        totalRetries: 0,
        totalCompensations: 0,
      };
      if (o.outcome === "delivered") s.delivered += 1;
      if (o.outcome === "cancelled") s.cancelled += 1;
      if (o.outcome === "refunded") s.refunded += 1;
      s.totalRetries += o.retries;
      s.totalCompensations += o.compensationsFired;
      perSku.set(it.sku, s);
    }
  }

  const menuSnapshot = menu.map((m) => {
    const stats = perSku.get(m.sku);
    const problems = stats
      ? stats.cancelled + stats.refunded
      : 0;
    return {
      sku: m.sku,
      name: m.name,
      price: m.price,
      hidden: Boolean(m.hidden),
      delivered: stats?.delivered ?? 0,
      cancelled: stats?.cancelled ?? 0,
      refunded: stats?.refunded ?? 0,
      problemOrders: problems,
    };
  });

  const reportSnippet = report
    .slice(-6)
    .map((r) => `- [${r.kind}] ${r.text}`)
    .join("\n");

  const focusLine = focused.length
    ? `The operator is currently focused on: ${focused.join(", ")}. Prefer proposals that touch those SKUs.`
    : "No specific focus — look at the whole menu.";

  const result = await generateObject({
    model: "anthropic/claude-haiku-4.5",
    schema,
    prompt: [
      "You are an analyst bot that suggests concrete menu changes for a delivery app.",
      "Given the current menu + recent order stats, return 3-4 short, direct asks the operator could send to the analyst.",
      "Each proposal must be phrased as a FIRST-PERSON imperative the operator would send in chat (e.g. \"Hide sushi-omakase — it's dragging refunds.\" or \"Drop Margherita Pizza price to $14.50.\").",
      "Ground every suggestion in the data: cite the SKU and a specific number (price, cancel count, refund count) when possible.",
      "Never duplicate existing state — don't propose hiding an already-hidden SKU or raising a price you don't have data for.",
      "Keep each proposal under 160 characters and action-oriented.",
      "",
      focusLine,
      "",
      "MENU + ORDER STATS (last 60 orders):",
      JSON.stringify(menuSnapshot, null, 2),
      "",
      reportSnippet
        ? `RECENT ANALYST REPORT ENTRIES:\n${reportSnippet}`
        : "No report entries yet.",
    ].join("\n"),
  });

  return Response.json({ proposals: result.object.proposals });
}
