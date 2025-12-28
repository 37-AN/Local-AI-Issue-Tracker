import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  canWrite,
  deny,
  getActorContext,
  getClientIp,
  writeAuditLog,
} from "@/lib/rbac";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await ctx.params;

  const { data, error } = await (supabase.from("tickets") as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  return NextResponse.json({ ok: true, ticket: data });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const actor = await getActorContext(supabase);

  if (!canWrite(actor.role)) {
    return NextResponse.json(deny("Engineer or Admin role required"), { status: 403 });
  }

  const { id } = await ctx.params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { data: before } = await (supabase.from("tickets") as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });
  }

  const updates: any = {};
  const fieldsChanged: string[] = [];

  const allowedFields = ["title", "description", "resolutionNotes", "type", "priority", "service", "site", "topics"];

  for (const f of allowedFields) {
    if (body[f] !== undefined) {
      const dbField = f === "resolutionNotes" ? "resolution_notes" : f;
      if (JSON.stringify(body[f]) !== JSON.stringify(before[dbField])) {
        updates[dbField] = body[f];
        fieldsChanged.push(f);
      }
    }
  }

  if (fieldsChanged.length === 0) {
    return NextResponse.json({ ok: true, ticket: before, message: "No changes" });
  }

  const { data: updated, error } = await (supabase.from("tickets") as any)
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await (supabase.from("ticket_events") as any).insert({
    ticket_id: (updated as any).id,
    actor_id: actor.userId,
    event_type: "updated",
    payload: { fields: fieldsChanged },
  });

  await writeAuditLog(supabase, {
    actor_id: actor.userId,
    actor_role: actor.role,
    action: "tickets.update",
    entity_type: "ticket",
    entity_id: (updated as any).id,
    before: before ?? null,
    after: updated,
    ip: getClientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, ticket: updated });
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const actor = await getActorContext(supabase);

  if (actor.role !== "Admin") {
    return NextResponse.json(deny("Admin role required"), { status: 403 });
  }

  const { id } = await ctx.params;

  const { error } = await (supabase.from("tickets") as any).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
