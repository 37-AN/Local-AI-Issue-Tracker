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
  return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
}

function isTicketType(v: string): v is TicketType {
  return ["Incident", "Service Request", "Problem", "Change"].includes(v);
}

function isTicketStatus(v: string): v is TicketStatus {
  return ["Open", "In Progress", "Resolved", "Closed"].includes(v);
}

function isTicketPriority(v: string): v is TicketPriority {
  return ["P1", "P2", "P3", "P4"].includes(v);
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const url = new URL(request.url);

    const statusParam = url.searchParams.get("status");
    const q = (url.searchParams.get("q") ?? "").trim();
    const topicsParam = (url.searchParams.get("topics") ?? "").trim();

    let query = supabase.from("tickets").select("*").order("updated_at", { ascending: false }).limit(200);

    if (statusParam && isTicketStatus(statusParam)) {
      query = query.eq("status", statusParam);
    }

    const topics = topicsParam
      ? topicsParam.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    if (topics.length > 0) {
      query = query.contains("topics", topics);
    }

    if (q) {
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
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: `Internal Server Error: ${err.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const actor = await getActorContext(supabase);

    if (!canWrite(actor.role)) {
      return NextResponse.json(deny("Engineer or Admin role required"), { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
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

    const { data: inserted, error: insertErr } = await (supabase.from("tickets") as any)
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

    await (supabase.from("ticket_events") as any).insert({
      ticket_id: (inserted as any).id,
      actor_id: actor.userId,
      event_type: "created",
      payload: {
        title: (inserted as any).title,
        type: (inserted as any).type,
        priority: (inserted as any).priority,
        status: (inserted as any).status,
        topics: (inserted as any).topics,
      },
    });

    await writeAuditLog(supabase, {
      actor_id: actor.userId,
      actor_role: actor.role,
      action: "tickets.create",
      entity_type: "ticket",
      entity_id: (inserted as any).id,
      before: null,
      after: inserted,
      ip: getClientIp(request),
      user_agent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, ticket: inserted });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: `Internal Server Error: ${err.message}` }, { status: 500 });
  }
}
