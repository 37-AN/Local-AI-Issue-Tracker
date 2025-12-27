import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  canWrite,
  deny,
  getActorContext,
  getClientIp,
  writeAuditLog,
} from "@/lib/rbac";

// ... existing code ...

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const actor = await getActorContext(supabase);

  if (!canWrite(actor.role)) {
    return NextResponse.json(deny("Engineer or Admin role required"), { status: 403 });
  }

  const { id } = await ctx.params;

  const { data: before } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle();

  // ... existing body parsing + updates building ...

  const { data: updated, error } = await supabase
    .from("tickets")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await supabase.from("ticket_events").insert({
    ticket_id: updated.id,
    actor_id: actor.userId,
    event_type: "updated",
    payload: { fields: fieldsChanged },
  });

  await writeAuditLog(supabase, {
    actor_id: actor.userId,
    actor_role: actor.role,
    action: "tickets.update",
    entity_type: "ticket",
    entity_id: updated.id,
    before: before ?? null,
    after: updated,
    ip: getClientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, ticket: updated });
}
