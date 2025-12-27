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
  // After that: only Admin may create users (for now, or maybe anyone can register as Viewer).
  // The original prompt implies privacy-first incidents, so let's stick to RBAC.
  let role: Role = "Viewer";
  if (userCount === 0) {
    role = "Admin";
  } else {
    // If it's not the first user, we check if the requester is Admin.
    // If not, we could allow registration as Viewer by default.
    if (canAdmin(actor.role)) {
      role = isRole(roleRaw) ? roleRaw : "Viewer";
    } else {
      // Registration as viewer only if no admin is logged in? 
      // For a local-first app, maybe we just allow it but default to Viewer.
      role = "Viewer";
    }
  }

  try {
    const created = await createLocalUser({ supabase, username, password, role });

    await writeAuditLog(supabase, {
      actor_id: actor.userId,
      actor_role: actor.role,
      action: userCount === 0 ? "auth.bootstrap_admin" : "auth.register",
      entity_type: "local_user",
      entity_id: created.id,
      before: null,
      after: { username: created.username, role: created.role },
      ip: getClientIp(request),
      user_agent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, user: created });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
