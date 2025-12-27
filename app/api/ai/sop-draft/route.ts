import { NextResponse } from "next/server";
import { aiSopDraft } from "@/lib/ai";
import { metrics, observeHttp, startTimer } from "@/lib/metrics";
import {
  canWrite,
  deny,
  getActorContext,
  getClientIp,
  writeAuditLog,
} from "@/lib/rbac";

type Body = {
  ticketTitle?: unknown;
  ticketDescription?: unknown;
  resolutionNotes?: unknown;
  validationNotes?: unknown;
  rollbackNotes?: unknown;
  topics?: unknown;
};

export async function POST(request: Request) {
  const stop = startTimer();
  let statusCode = 200;

  const supabaseForAuth = await (await import("@/lib/supabase/server")).createClient();
  const actor = await getActorContext(supabaseForAuth);

  if (!canWrite(actor.role)) {
    statusCode = 403;
    const durationSeconds = stop();
    observeHttp({ route: "/api/ai/sop-draft", method: "POST", status: statusCode, durationSeconds });
    return NextResponse.json(deny("Engineer or Admin role required"), { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    statusCode = 400;
    const durationSeconds = stop();
    observeHttp({ route: "/api/ai/sop-draft", method: "POST", status: statusCode, durationSeconds });
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
    statusCode = 400;
    const durationSeconds = stop();
    observeHttp({ route: "/api/ai/sop-draft", method: "POST", status: statusCode, durationSeconds });
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

    metrics().aiSopDraftRequestsTotal.inc({ status: "ok" }, 1);
    metrics().aiSopDraftEvidenceItemsTotal.inc(
      { status: "ok" },
      result.evidence.length
    );

    await writeAuditLog(supabaseForAuth, {
      actor_id: actor.userId,
      actor_role: actor.role,
      action: "ai.sop_draft",
      entity_type: "ai",
      entity_id: null,
      before: null,
      after: {
        ticketTitle,
        topics,
        evidence_count: result.evidence.length,
      },
      ip: getClientIp(request),
      user_agent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI request failed";
    metrics().aiSopDraftRequestsTotal.inc({ status: "error" }, 1);
    statusCode = 500;
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  } finally {
    const durationSeconds = stop();
    metrics().aiSopDraftDurationSeconds.observe(
      { status: statusCode >= 400 ? "error" : "ok" },
      durationSeconds
    );
    observeHttp({
      route: "/api/ai/sop-draft",
      method: "POST",
      status: statusCode,
      durationSeconds,
    });
  }
}
