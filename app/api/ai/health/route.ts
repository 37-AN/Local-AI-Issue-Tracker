import { NextResponse } from "next/server";
import { LocalAIConnector } from "@/lib/ai";

export async function GET() {
  const connector = new LocalAIConnector();
  const isHealthy = await connector.healthCheck();

  const endpoint = process.env.LOCAL_AI_ENDPOINT ?? "http://localhost:8080";
  const model = process.env.LOCAL_AI_MODEL ?? "gpt-4";

  return NextResponse.json({
    ok: isHealthy,
    host: endpoint,
    model: model,
    status: isHealthy ? "Online" : "Offline",
  });
}
