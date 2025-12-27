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

export async function POST(request: Request) {
  const supabase = await createClient();
  const actor = await getActorContext(supabase);

  // ... existing code ...

  console.log(
    `[admin.user_roles] set role requester=${actor.userId ?? "-"} target=${userId} role=${role}`
  );

  // ... existing code ...
}
