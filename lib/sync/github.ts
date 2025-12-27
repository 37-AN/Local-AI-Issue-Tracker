import { ragUpsert } from "@/lib/rag";
import { createClient } from "@/lib/supabase/server";

export async function syncGitHubIssues(repo: string, token?: string) {
    const supabase = await createClient();

    // Track sync start
    const { data: logEntry, error: logError } = await supabase
        .from("sync_logs")
        .insert({
            source: `github:${repo}`,
            status: "running",
            items_processed: 0,
        })
        .select("*")
        .single();

    if (logError || !logEntry) throw new Error(logError?.message || "Failed to create sync log");

    try {
        const headers: Record<string, string> = {
            "Accept": "application/vnd.github.v3+json",
        };
        if (token) {
            headers["Authorization"] = `token ${token}`;
        }

        // Fetch resolved (closed) issues
        const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=closed&per_page=30`, {
            headers,
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`GitHub API error: ${errText}`);
        }

        const issues = await res.json() as any[];
        let processedCount = 0;

        for (const issue of issues) {
            // Basic heuristic: check if it's an issue and has a resolution (closed)
            if (issue.pull_request) continue;

            const content = `
TITLE: ${issue.title}
BODY: ${issue.body}
LABELS: ${issue.labels.map((l: { name: string }) => l.name).join(", ")}
STATE: ${issue.state}
URL: ${issue.html_url}
      `.trim();

            await ragUpsert({
                sourceType: "github_issue",
                sourceId: String(issue.id),
                title: issue.title,
                content,
                metadata: {
                    repo,
                    number: issue.number,
                    url: issue.html_url,
                    closed_at: issue.closed_at,
                },
            });
            processedCount++;
        }

        // Update log
        await supabase
            .from("sync_logs")
            .update({
                status: "completed",
                items_processed: processedCount,
                finished_at: new Date().toISOString(),
            })
            .eq("id", logEntry.id);

        return { processedCount };
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Sync failed";
        await supabase
            .from("sync_logs")
            .update({
                status: "failed",
                error_message: msg,
                finished_at: new Date().toISOString(),
            })
            .eq("id", logEntry.id);
        throw e;
    }
}
