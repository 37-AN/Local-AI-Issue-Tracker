import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActorContext, getClientIp, writeAuditLog } from "@/lib/rbac";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const supabase = await createClient();
  const actor = await getActorContext(supabase);
  const session = await getSession();

  const userId = session.userId ?? null;
  const username = session.username ?? null;

  console.log(`[auth.logout] request userId=${userId ?? "-"} username=${username ?? "-"}`);

  await writeAuditLog(supabase, {
    actor_id: userId,
    actor_role: actor.role,
    action: "auth.logout",
    entity_type: "session",
    entity_id: userId,
    before: null,
    after: null,
    ip: getClientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  session.destroy();

  return NextResponse.json({ ok: true });
}
