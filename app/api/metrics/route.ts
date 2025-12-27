import { NextResponse } from "next/server";
import { metrics } from "@/lib/metrics";

export const runtime = "nodejs";

export async function GET() {
  const m = metrics();
  const body = await m.registry.metrics();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": m.registry.contentType,
      "cache-control": "no-store",
    },
  });
}
