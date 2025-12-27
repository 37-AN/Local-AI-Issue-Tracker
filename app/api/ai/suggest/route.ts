import { NextResponse } from "next/server";
import { aiSuggest } from "@/lib/ai";

type Body = {
  title?: unknown;
  description?: unknown;
  topics?: unknown;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : "";
  const description = typeof body.description === "string" ? body.description : "";

  const topics = Array.isArray(body.topics)
    ? body.topics.filter((t): t is string => typeof t === "string")
    : [];

  if (!title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const result = await aiSuggest({ title, description, topics });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI request failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
