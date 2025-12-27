import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActorContext, getClientIp } from "@/lib/rbac";

export const runtime = "nodejs";

type Level = "log" | "info" | "warn" | "error";
type Body = { level?: unknown; message?: unknown; context?: unknown };

function isLevel(v: unknown): v is Level {
  return v === "log" || v === "info" || v === "warn" || v === "error";
}

// basic in-memory rate limit: 60 req/min per IP
type Bucket = { count: number; resetAt: number };
const g = globalThis as unknown as { __clientLogBuckets?: Map<string, Bucket> };
const buckets = g.__clientLogBuckets ?? (g.__clientLogBuckets = new Map<string, Bucket>());

function allow(ip: string) {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now >= b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (b.count >= 60) return false;
  b.count += 1;
  return true;
}

export async function POST(request: Request) {
  // If the browser closes/refreshes, this request can be aborted mid-flight.
  // Don't try to write a JSON response body in that case (can trigger ECONNRESET logs).
  if (request.signal.aborted) {
    return new Response(null, { status: 204 });
  }

  const supabase = await createClient();
  const actor = await getActorContext(supabase);

  const ip = getClientIp(request) ?? "unknown";
  if (!allow(ip)) {
    return new Response(null, { status: 429 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    // Treat aborted body reads as a normal client disconnect.
    if (msg.toLowerCase().includes("aborted")) {
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 400 });
  }

  const level: Level = isLevel(body.level) ? body.level : "log";
  const message = typeof body.message === "string" ? body.message : "";
  const context = body.context;

  if (!message.trim()) {
    return NextResponse.json({ ok: false, error: "message required" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ ok: false, error: "message too long" }, { status: 400 });
  }

  const prefix = `[client.${level}]`;
  const meta = `userId=${actor.userId ?? "-"} username=${actor.username ?? "-"} role=${actor.role} ip=${ip}`;
  const ua = request.headers.get("user-agent") ?? "-";

  // Server-side log line
  if (level === "error") {
    console.error(prefix, meta, "ua=" + ua, message, context ?? "");
  } else if (level === "warn") {
    console.warn(prefix, meta, "ua=" + ua, message, context ?? "");
  } else {
    console.log(prefix, meta, "ua=" + ua, message, context ?? "");
  }

  return new Response(null, { status: 204 });
}
