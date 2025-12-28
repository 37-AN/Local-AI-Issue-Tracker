import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ragUpsert } from "@/lib/rag";
import { getActorContext, getClientIp, writeAuditLog } from "@/lib/rbac";

type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";

function isTicketStatus(v: string): v is TicketStatus {
  return ["Open", "In Progress", "Resolved", "Closed"].includes(v);
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const actor = await getActorContext(supabase);
  const { id } = await ctx.params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const nextStatus = typeof body.status === "string" ? body.status : "";
  if (!isTicketStatus(nextStatus)) {
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
  }

  const { data: existing, error: getErr } = await (supabase.from("tickets") as any)
    .select("*")
    .eq("id", id)
    .single();

  if (getErr || !existing) return NextResponse.json({ ok: false, error: getErr?.message ?? "Not found" }, { status: 404 });

  const fromStatus = existing.status;
  const patch: any = { status: nextStatus };

  if (nextStatus === "Resolved" && !existing.resolved_at) patch.resolved_at = new Date().toISOString();
  if (nextStatus === "Closed" && !existing.closed_at) patch.closed_at = new Date().toISOString();

  const { data: updated, error: updErr } = await (supabase.from("tickets") as any)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });

  await (supabase.from("ticket_events") as any).insert({
    ticket_id: updated.id,
    actor_id: actor.userId,
    event_type: "status_changed",
    from_status: fromStatus,
    to_status: nextStatus,
    payload: {},
  });

  await writeAuditLog(supabase, {
    actor_id: actor.userId,
    actor_role: actor.role,
    action: "tickets.status_change",
    entity_type: "ticket",
    entity_id: updated.id,
    before: { status: fromStatus },
    after: { status: updated.status },
    ip: getClientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  // When a ticket is resolved, store into RAG memory for future retrieval.
  if (nextStatus === "Resolved") {
    const contentParts = [
      `Title: ${updated.title}`,
      updated.service ? `Service: ${updated.service}` : "",
      updated.site ? `Site: ${updated.site}` : "",
      updated.topics?.length ? `Topics: ${updated.topics.join(", ")}` : "",
      "",
      "Description:",
      updated.description ?? "",
      "",
      "Resolution Notes:",
      updated.resolution_notes ?? "",
    ].filter(Boolean);

    const content = contentParts.join("\n");

    try {
      await ragUpsert({
        sourceType: "ticket",
        sourceId: updated.external_id ?? updated.id,
        title: updated.title,
        content,
        metadata: {
          ticket_id: updated.id,
          external_id: updated.external_id,
          type: updated.type,
          priority: updated.priority,
          status: updated.status,
          service: updated.service,
          site: updated.site,
          topics: updated.topics,
          resolved_at: updated.resolved_at,
        },
      });
    } catch (e) {
      console.error("Failed to upsert RAG:", e);
    }
  }

  return NextResponse.json({ ok: true, ticket: updated });
}
