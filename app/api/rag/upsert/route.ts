import { NextResponse } from "next/server";
import { ragSearch } from "@/lib/rag";

type SearchBody = {
  query?: unknown;
  limit?: unknown;
  filterSourceType?: unknown;
};

export async function POST(request: Request) {
  let body: SearchBody;
  try {
    body = (await request.json()) as SearchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query : "";
  if (!query.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const limit = typeof body.limit === "number" ? body.limit : undefined;
  const filterSourceType =
    typeof body.filterSourceType === "string" ? body.filterSourceType : null;

  try {
    const results = await ragSearch({ query, limit, filterSourceType });
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
