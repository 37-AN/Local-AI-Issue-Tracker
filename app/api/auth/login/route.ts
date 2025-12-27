import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActorContext } from "@/lib/rbac";

export async function GET() {
  const supabase = await createClient();
  const actor = await getActorContext(supabase);

  return NextResponse.json({
    ok: true,
    userId: actor.userId,
    username: actor.username,
    role: actor.role,
  });
}
