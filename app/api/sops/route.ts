import { NextResponse } from "next/server";
import { createSop, listSops } from "@/lib/sops";
import { getActorContext, canWrite, deny } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const tagsParam = url.searchParams.get("tags") ?? "";
    const tags = tagsParam ? tagsParam.split(",").map(t => t.trim()).filter(Boolean) : [];

    try {
        const sops = await listSops({ query: q, tags });
        return NextResponse.json({ ok: true, sops });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load SOPs";
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const actor = await getActorContext(supabase);

    if (!canWrite(actor.role)) {
        return NextResponse.json(deny("Engineer or Admin role required"), { status: 403 });
    }

    try {
        const body = await request.json();
        const sop = await createSop(body);
        return NextResponse.json({ ok: true, sop });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create SOP";
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
