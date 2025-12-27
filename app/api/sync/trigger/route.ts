import { NextResponse } from "next/server";
import { syncGitHubIssues } from "@/lib/sync/github";
import { getActorContext, canWrite, deny } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    const supabase = await createClient();
    const actor = await getActorContext(supabase);

    if (!canWrite(actor.role)) {
        return NextResponse.json(deny("Engineer or Admin role required"), { status: 403 });
    }

    try {
        const body = await request.json();
        const { source, repo, token } = body;

        if (source === "github") {
            if (!repo) return NextResponse.json({ error: "repo is required for github source" }, { status: 400 });
            // Offload sync to not block the request for too long if many issues
            // But for small sets we can await
            const result = await syncGitHubIssues(repo, token || process.env.GITHUB_TOKEN);
            return NextResponse.json({ ok: true, ...result });
        }

        return NextResponse.json({ error: "Unsupported source" }, { status: 400 });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Sync failed";
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
