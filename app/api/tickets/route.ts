import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  canWrite,
  deny,
  getActorContext,
  getClientIp,
  writeAuditLog,
} from "@/lib/rbac";

type TicketType = "Incident" | "Service Request" | "Problem" | "Change";
type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";
type TicketPriority = "P1" | "P2" | "P3" | "P4";

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
  return out;
}

function isTicketType(v: string): v is TicketType {
  return v === "Incident" || v === "Service Request" || v === "Problem" || v === "Change";
}

function isTicketStatus(v: string): v is TicketStatus {
  return v === "Open" || v === "In Progress" || v === "Resolved" || v === "Closed";
}

function isTicketPriority(v: string): v is TicketPriority {
  return v === "P1" || v === "P2" || v === "P3" || v === "P4";
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);

  const statusParam = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim();
  const topic = (url.searchParams.get("topic") ?? "").trim();
  const topicsParam = (url.searchParams.get("topics") ?? "").trim(); // comma separated

  let query = supabase.from("tickets").select("*").order("updated_at", { ascending: false }).limit(200);

  if (statusParam && isTicketStatus(statusParam)) {
    query = query.eq("status", statusParam);
  }

  const topics = topicsParam
    ? topicsParam.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  if (topic) topics.push(topic);

  if (topics.length > 0) {
    query = query.contains("topics", topics);
  }

  if (q) {
    // Lightweight search over a few fields
    query = query.or(
      [
        `title.ilike.%${q}%`,
        `description.ilike.%${q}%`,
        `external_id.ilike.%${q}%`,
        `service.ilike.%${q}%`,
        `site.ilike.%${q}%`,
      ].join(",")
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, tickets: data ?? [] });
}

type CreateBody = {
  externalId?: unknown;
  title?: unknown;
  description?: unknown;
  type?: unknown;
  priority?: unknown;
  service?: unknown;
  site?: unknown;
  topics?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const actor = await getActorContext(supabase);

  if (!canWrite(actor.role)) {
    return NextResponse.json(deny("Engineer or Admin role required"), { status: 403 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const title = asString(body.title)?.trim() ?? "";
  const description = asString(body.description)?.trim() ?? "";
  const type = asString(body.type)?.trim() ?? "";
  const priority = asString(body.priority)?.trim() ?? "";
  const externalId = asString(body.externalId)?.trim() ?? null;
  const service = asString(body.service)?.trim() ?? null;
  const site = asString(body.site)?.trim() ?? null;
  const topics = asStringArray(body.topics) ?? [];

  if (!title) return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
  if (!type || !isTicketType(type)) {
    return NextResponse.json({ ok: false, error: "type is invalid" }, { status: 400 });
  }
  if (!priority || !isTicketPriority(priority)) {
    return NextResponse.json({ ok: false, error: "priority is invalid" }, { status: 400 });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("tickets")
    .insert({
      external_id: externalId,
      title,
      description,
      type,
      priority,
      status: "Open",
      service,
      site,
      topics,
      created_by: actor.userId,
    })
    .select("*")
    .single();

  if (insertErr) return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });

  await supabase.from("ticket_events").insert({
    ticket_id: inserted.id,
    actor_id: actor.userId,
    event_type: "created",
    payload: {
      title: inserted.title,
      type: inserted.type,
      priority: inserted.priority,
      status: inserted.status,
      topics: inserted.topics,
    },
  });

  await writeAuditLog(supabase, {
    actor_id: actor.userId,
    actor_role: actor.role,
    action: "tickets.create",
    entity_type: "ticket",
    entity_id: inserted.id,
    before: null,
    after: inserted,
    ip: getClientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, ticket: inserted });
}
