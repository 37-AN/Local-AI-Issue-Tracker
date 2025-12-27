import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLocalUser, countLocalUsers } from "@/lib/local-auth";
import { canAdmin, deny, getActorContext, getClientIp, writeAuditLog } from "@/lib/rbac";

type Role = "Admin" | "Engineer" | "Viewer";
function isRole(v: string): v is Role {
  return v === "Admin" || v === "Engineer" || v === "Viewer";
}

type Body = { username?: unknown; password?: unknown; role?: unknown };

export async function POST(request: Request) {
  const supabase = await createClient();
  const actor = await getActorContext(supabase);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const roleRaw = typeof body.role === "string" ? body.role : "Viewer";

  if (!username) return NextResponse.json({ ok: false, error: "username required" }, { status: 400 });
  if (!password || password.length < 8) {
    return NextResponse.json({ ok: false, error: "password must be at least 8 chars" }, { status: 400 });
  }

  const userCount = await countLocalUsers(supabase);

  // Bootstrap: first ever user becomes Admin automatically.
  // After that: only Admin may create users.
  let role: Role = "Viewer";
  if (userCount === 0) {
    role = "Admin";
  } else {
    if (!canAdmin(actor.role)) {
      return NextResponse.json(deny("Admin role required to create users"), { status: 403 });
    }
    role = isRole(roleRaw) ? roleRaw : "Viewer";
  }

  const created = await createLocalUser({ supabase, username, password, role });

  await writeAuditLog(supabase, {
    actor_id: actor.userId,
    actor_role: actor.role,
    action: userCount === 0 ? "auth.bootstrap_admin" : "auth.create_user",
    entity_type: "local_user",
    entity_id: created.id,
    before: null,
    after: { username: created.username, role: created.role },
    ip: getClientIp(request),
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, user: created });
}
