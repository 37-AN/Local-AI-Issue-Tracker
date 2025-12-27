import { NextResponse } from "next/server";
import { ragSearch } from "@/lib/rag";

type SimilarTicketsBody = {
  title?: unknown;
  description?: unknown;
  limit?: unknown;
};

export async function POST(request: Request) {
  let body: SimilarTicketsBody;
  try {
    body = (await request.json()) as SimilarTicketsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : "";
  const description = typeof body.description === "string" ? body.description : "";
  const limit = typeof body.limit === "number" ? body.limit : 8;

  const query = [title.trim(), description.trim()].filter(Boolean).join("\n\n");
  if (!query) {
    return NextResponse.json(
      { error: "title or description is required" },
      { status: 400 }
    );
  }

  try {
    const results = await ragSearch({
      query,
      limit,
      filterSourceType: "ticket",
    });

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
