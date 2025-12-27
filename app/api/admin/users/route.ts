import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAdmin, deny, getActorContext } from "@/lib/rbac";

export async function GET() {
  const supabase = await createClient();
  const actor = await getActorContext(supabase);

  if (!canAdmin(actor.role)) {
    return NextResponse.json(deny("Admin role required"), { status: 403 });
  }

  // Fetch users with their roles
  const { data, error } = await supabase
    .from("local_users")
    .select(`
      id,
      username,
      created_at,
      user_roles (
        role
      )
    `);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const users = (data || []).map((u: any) => ({
    id: u.id,
    username: u.username,
    role: u.user_roles?.[0]?.role ?? "Viewer",
    created_at: u.created_at,
  }));

  return NextResponse.json({ ok: true, users });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const actor = await getActorContext(supabase);

  if (!canAdmin(actor.role)) {
    return NextResponse.json(deny("Admin role required"), { status: 403 });
  }

  // In a real app, this might be used to create users directly, 
  // but we usually use /api/auth/register.
  // We'll leave it as a stub or implement if needed.
  return NextResponse.json({ ok: false, error: "Use /api/auth/register to create users" }, { status: 405 });
}
