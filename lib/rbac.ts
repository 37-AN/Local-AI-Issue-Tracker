import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/database.types";

export type Role = "Admin" | "Engineer" | "Viewer";

export type ActorContext = {
  userId: string | null;
  role: Role;
};

function normalizeRole(role: string | null | undefined): Role {
  if (role === "Admin" || role === "Engineer" || role === "Viewer") return role;
  return "Viewer";
}

export async function getActorContext(
  supabase: SupabaseClient<Database>
): Promise<ActorContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  if (!userId) return { userId: null, role: "Viewer" };

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { userId, role: "Viewer" };
  return { userId, role: normalizeRole(data?.role ?? null) };
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
  supabase: SupabaseClient<Database>,
  entry: Omit<Tables<"audit_logs">, "id" | "created_at">
) {
  // best-effort; do not block the request if auditing fails
  try {
    await supabase.from("audit_logs").insert(entry);
  } catch {
    // ignore
  }
}
