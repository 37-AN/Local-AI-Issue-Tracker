import { NextResponse } from "next/server";
import { aiSopDraft } from "@/lib/ai";

type Body = {
  ticketTitle?: unknown;
  ticketDescription?: unknown;
  resolutionNotes?: unknown;
  validationNotes?: unknown;
  rollbackNotes?: unknown;
  topics?: unknown;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ticketTitle = typeof body.ticketTitle === "string" ? body.ticketTitle : "";
  const ticketDescription =
    typeof body.ticketDescription === "string" ? body.ticketDescription : "";
  const resolutionNotes =
    typeof body.resolutionNotes === "string" ? body.resolutionNotes : "";

  const validationNotes =
    typeof body.validationNotes === "string" ? body.validationNotes : undefined;
  const rollbackNotes =
    typeof body.rollbackNotes === "string" ? body.rollbackNotes : undefined;

  const topics = Array.isArray(body.topics)
    ? body.topics.filter((t): t is string => typeof t === "string")
    : [];

  if (!ticketTitle.trim() || !resolutionNotes.trim()) {
    return NextResponse.json(
      { error: "ticketTitle and resolutionNotes are required" },
      { status: 400 }
    );
  }

  try {
    const result = await aiSopDraft({
      ticketTitle,
      ticketDescription,
      resolutionNotes,
      validationNotes,
      rollbackNotes,
      topics,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI request failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
