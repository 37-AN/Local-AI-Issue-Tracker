import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAdmin, deny, getActorContext, getClientIp, writeAuditLog } from "@/lib/rbac";

export async function POST(request: Request) {
  const supabase = await createClient();
  const actor = await getActorContext(supabase);

  if (!canAdmin(actor.role)) {
    return NextResponse.json(deny("Admin role required"), { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, role } = body;
  if (!userId || !role) {
    return NextResponse.json({ ok: false, error: "userId and role required" }, { status: 400 });
  }

  const { error } = await (supabase.from("user_roles") as any)
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await writeAuditLog(supabase, {
    actor_id: actor.userId,
    actor_role: actor.role,
    action: "admin.set_user_role",
    entity_type: "user_role",
    entity_id: userId,
    before: null,
    after: { role },
    ip: getClientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
