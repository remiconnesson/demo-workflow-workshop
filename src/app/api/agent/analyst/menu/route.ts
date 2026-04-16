import { getMenu } from "@/lib/ops-data";

export async function GET() {
  return Response.json({ items: getMenu() });
}
