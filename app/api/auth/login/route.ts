import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";
import { verifyLocalLogin } from "@/lib/local-auth";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { username, password } = (await request.json()) as { username?: string; password?: string };

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "Username and password are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await verifyLocalLogin({ supabase, username, password });

    if (!user) {
      return NextResponse.json({ ok: false, error: "Invalid username or password" }, { status: 401 });
    }

    const session = await getSession();
    session.userId = user.userId;
    session.username = user.username;
    await session.save();

    return NextResponse.json({ ok: true, ...user });

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: `Internal Server Error: ${err.message}` }, { status: 500 });
  }
}