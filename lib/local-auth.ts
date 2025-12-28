import argon2 from "argon2";
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";

export type LocalRole = "Admin" | "Engineer" | "Viewer";

function normalizeRole(role: string | null | undefined): LocalRole {
  if (role === "Admin" || role === "Engineer" || role === "Viewer") return role;
  return "Viewer";
}

function makeSaltBase64(): string {
  return randomBytes(16).toString("base64");
}

function passwordMaterial(password: string, saltBase64: string) {
  return `${password}:salt:${saltBase64}`;
}

export async function createLocalUser(params: {
  supabase: any;
  username: string;
  password: string;
  role: LocalRole;
}) {
  const username = params.username.trim();
  if (!username) throw new Error("username required");
  if (params.password.length < 8) throw new Error("password must be at least 8 chars");

  const salt = makeSaltBase64();
  const hash = await argon2.hash(passwordMaterial(params.password, salt), {
    type: argon2.argon2id,
  });

  const { data: user, error } = await params.supabase
    .from("local_users")
    .insert({
      username,
      password_salt: salt,
      password_hash: hash,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const { error: roleErr } = await params.supabase
    .from("user_roles")
    .upsert({ user_id: user.id, role: params.role }, { onConflict: "user_id" });

  if (roleErr) throw new Error(roleErr.message);

  return { id: user.id, username: user.username, role: params.role };
}

export async function verifyLocalLogin(params: {
  supabase: any;
  username: string;
  password: string;
}): Promise<{ userId: string; username: string; role: LocalRole } | null> {
  const username = params.username.trim();
  if (!username) return null;

  const { data: user, error } = await params.supabase
    .from("local_users")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (error || !user) return null;

  const ok = await argon2.verify(
    user.password_hash,
    passwordMaterial(params.password, user.password_salt)
  );

  if (!ok) return null;

  const { data: roleRow } = await params.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  return { userId: user.id, username: user.username, role: normalizeRole(roleRow?.role) };
}

export async function countLocalUsers(supabase: any): Promise<number> {
  const { count, error } = await supabase
    .from("local_users")
    .select("id", { count: "exact", head: true });

  if (error) throw new Error(error.message);
  return count ?? 0;
}
