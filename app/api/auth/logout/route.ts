import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActorContext } from "@/lib/rbac";

// ... existing code ...
export async function POST(request: Request) {
  const supabase = await createClient();
  const session = await getSession();

  const actorId = session.userId ?? null;
  const username = session.username ?? null;

  console.log(`[auth.logout] request userId=${actorId ?? "-"} username=${username ?? "-"}`);

  session.destroy();

  // ... existing audit log ...
  return NextResponse.json({ ok: true });
}
