import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/database.types";
import { getSession } from "@/lib/session";

export type Role = "Admin" | "Engineer" | "Viewer";

export type ActorContext = {
  userId: string | null;
  username: string | null;
  role: Role;
};

function normalizeRole(role: string | null | undefined): Role {
  if (role === "Admin" || role === "Engineer" || role === "Viewer") return role;
  return "Viewer";
}

export async function getActorContext(
  supabase: any
): Promise<ActorContext> {
  const session = await getSession();
  const userId = session.userId ?? null;
  const username = session.username ?? null;

  if (!userId) return { userId: null, username: null, role: "Viewer" };

  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return { userId, username, role: "Viewer" };
    return { userId, username, role: normalizeRole(data?.role ?? null) };
  } catch {
    return { userId, username, role: "Viewer" };
  }
}

export function canWrite(role: Role): boolean {
  return role === "Admin" || role === "Engineer";
}

export function canAdmin(role: Role): boolean {
  return role === "Admin";
}

export function deny(reason: string) {
  return { ok: false as const, error: reason };
}

export function getClientIp(request: Request): string | null {
  const h = request.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null
  );
}

export async function writeAuditLog(
  supabase: any,
  entry: Omit<Tables<"audit_logs">, "id" | "created_at">
) {
  try {
    await supabase.from("audit_logs").insert(entry);
  } catch {
    // ignore
  }
}
