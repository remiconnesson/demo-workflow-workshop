import { getRollbackableSkus } from "@/lib/ops-data";

export async function GET() {
  return Response.json({ skus: getRollbackableSkus() });
}
