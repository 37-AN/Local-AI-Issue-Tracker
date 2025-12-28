import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  canWrite,
  deny,
  getActorContext,
  getClientIp,
  writeAuditLog,
} from "@/lib/rbac";

export async function POST(
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

  const { status } = body;
  if (!status) {
    return NextResponse.json({ ok: false, error: "Status required" }, { status: 400 });
  }

  const { data: before } = await (supabase.from("tickets") as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });
  }

  const updates: any = { status };
  if (status === "Resolved") {
    updates.resolved_at = new Date().toISOString();
  } else if (status === "Closed") {
    updates.closed_at = new Date().toISOString();
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
    event_type: "status_change",
    payload: { from: (before as any).status, to: status },
  });

  await writeAuditLog(supabase, {
    actor_id: actor.userId,
    actor_role: actor.role,
    action: "tickets.update_status",
    entity_type: "ticket",
    entity_id: (updated as any).id,
    before: { status: (before as any).status },
    after: { status: (updated as any).status },
    ip: getClientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, ticket: updated });
}
