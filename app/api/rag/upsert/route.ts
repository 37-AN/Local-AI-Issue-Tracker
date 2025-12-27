import { NextResponse } from "next/server";
import { ragUpsert } from "@/lib/rag";
import { getActorContext, canWrite, deny } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

type UpsertBody = {
  sourceType?: unknown;
  sourceId?: unknown;
  title?: unknown;
  content?: unknown;
  metadata?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const actor = await getActorContext(supabase);

  if (!canWrite(actor.role)) {
    return NextResponse.json(deny("Engineer or Admin role required"), { status: 403 });
  }

  let body: UpsertBody;
  try {
    body = (await request.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sourceType = typeof body.sourceType === "string" ? body.sourceType : "";
  const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
  const title = typeof body.title === "string" ? body.title : "";
  const content = typeof body.content === "string" ? body.content : "";
  const metadata = typeof body.metadata === "object" ? (body.metadata as Record<string, unknown>) : {};

  if (!sourceType || !sourceId || !title || !content) {
    return NextResponse.json(
      { error: "sourceType, sourceId, title, and content are required" },
      { status: 400 }
    );
  }

  try {
    const result = await ragUpsert({
      sourceType,
      sourceId,
      title,
      content,
      metadata,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
