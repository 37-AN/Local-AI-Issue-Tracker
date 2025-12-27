import { NextResponse } from "next/server";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

export async function GET() {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: "GET",
      headers: { "content-type": "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, host: OLLAMA_HOST, status: res.status },
        { status: 200 }
      );
    }

    const data: unknown = await res.json();
    return NextResponse.json({ ok: true, host: OLLAMA_HOST, tags: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unreachable";
    return NextResponse.json(
      { ok: false, host: OLLAMA_HOST, error: msg },
      { status: 200 }
    );
  }
}
