import type { Tables } from "@/database.types";

export type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";
export type TicketType = "Incident" | "Service Request" | "Problem" | "Change";
export type TicketPriority = "P1" | "P2" | "P3" | "P4";

export type TicketRow = Tables<"tickets">;
export type TicketEventRow = Tables<"ticket_events">;
export type SopRow = Tables<"sops">;

export type AiSuggestion =
    | {
        summary: string;
        confidence_overall: number;
        root_causes: Array<{
            cause: string;
            confidence: number;
            evidence_refs: string[];
        }>;
        recommended_steps: Array<{
            step: string;
            rationale: string;
            evidence_refs: string[];
        }>;
        validation_steps: string[];
        rollback_procedures: string[];
        questions: string[];
    }
    | { raw: string };

export type SopDraft =
    | {
        problem_description: string;
        symptoms: string[];
        root_cause: string;
        resolution_steps: string[];
        validation_steps: string[];
        rollback_procedures: string[];
        references: string[];
    }
    | { raw: string };

async function apiFetch<T>(
    url: string,
    options?: RequestInit
): Promise<T> {
    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || json.message || "Request failed");
    }

    return json as T;
}

// Auth
export const authApi = {
    getMe: () => apiFetch<{ user: any; ok: boolean }>("/api/auth/me"),
    login: (username: string, password?: string) =>
        apiFetch<{ ok: boolean }>("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password }),
        }),
    register: (username: string, password?: string) =>
        apiFetch<{ ok: boolean }>("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ username, password }),
        }),
    logout: () => fetch("/api/auth/logout", { method: "POST" }).catch(() => null),
};

// Tickets
export const ticketApi = {
    list: (filters: { status?: string; q?: string; topics?: string }) => {
        const params = new URLSearchParams();
        if (filters.status && filters.status !== "All") params.set("status", filters.status);
        if (filters.q) params.set("q", filters.q);
        if (filters.topics) params.set("topics", filters.topics);
        return apiFetch<{ tickets: TicketRow[] }>(`/api/tickets?${params.toString()}`);
    },
    create: (ticket: Partial<TicketRow>) =>
        apiFetch<{ ok: boolean; ticket: TicketRow }>("/api/tickets", {
            method: "POST",
            body: JSON.stringify(ticket),
        }),
    getEvents: (ticketId: string) =>
        apiFetch<{ events: TicketEventRow[] }>(`/api/tickets/${ticketId}/events`),
    update: (ticketId: string, updates: Partial<TicketRow>) =>
        apiFetch<{ ok: boolean; ticket: TicketRow }>(`/api/tickets/${ticketId}`, {
            method: "PATCH",
            body: JSON.stringify(updates),
        }),
    delete: (ticketId: string) =>
        apiFetch<{ ok: boolean }>(`/api/tickets/${ticketId}`, { method: "DELETE" }),
    updateStatus: (ticketId: string, status: TicketStatus) =>
        apiFetch<{ ok: boolean; ticket: TicketRow }>(`/api/tickets/${ticketId}/status`, {
            method: "POST",
            body: JSON.stringify({ status }),
        }),
};

// SOPs
export const sopApi = {
    list: (filters: { query?: string; tags?: string[] }) => {
        const params = new URLSearchParams();
        if (filters.query) params.set("query", filters.query);
        if (filters.tags?.length) params.set("tags", filters.tags.join(","));
        return apiFetch<{ sops: SopRow[] }>(`/api/sops?${params.toString()}`);
    },
};

// Admin
export const adminApi = {
    listUsers: () => apiFetch<{ users: any[] }>("/api/admin/users"),
    createUser: (user: any) =>
        apiFetch<{ ok: boolean }>("/api/admin/users", {
            method: "POST",
            body: JSON.stringify(user),
        }),
    updateUserRole: (userId: string, role: string) =>
        apiFetch<{ ok: boolean }>("/api/admin/user-roles", {
            method: "POST",
            body: JSON.stringify({ userId, role }),
        }),
};

// RAG
export const ragApi = {
    upsert: (payload: {
        sourceType: string;
        sourceId: string;
        title: string;
        content: string;
        metadata?: Record<string, any>;
    }) =>
        apiFetch<{ ok: boolean; chunksUpserted: number }>("/api/rag/upsert", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
    search: (payload: { query: string; limit?: number; filterSourceType?: string | null }) =>
        apiFetch<{ results: any[] }>("/api/rag/search", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
    findSimilarTickets: (payload: { title: string; description: string; limit?: number }) =>
        apiFetch<{ results: any[] }>("/api/rag/similar-tickets", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
};

// AI
export const aiApi = {
    getHealth: () => apiFetch<{ ok: boolean; host: string; status: string; model: string }>("/api/ai/health"),
    suggest: (payload: { title: string; description: string; topics?: string[] }) =>
        apiFetch<{ ok: boolean; evidence: any[]; suggestion: AiSuggestion; model: any }>("/api/ai/suggest", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
    submitRating: (payload: {
        ticketId: string;
        recommendationPayload: any;
        rating: number;
        feedback?: string;
        modelInfo: any;
    }) =>
        apiFetch<{ ok: boolean }>("/api/ai/ratings", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
    getSopDraft: (payload: {
        ticketTitle: string;
        ticketDescription: string;
        resolutionNotes: string;
        topics?: string[];
    }) =>
        apiFetch<{ ok: boolean; evidence: any[]; sop: SopDraft; model: any }>("/api/ai/sop-draft", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
};

// Sync
export const syncApi = {
    trigger: (source: string, repo?: string, token?: string) =>
        apiFetch<{ ok: boolean; processedCount: number }>("/api/sync/trigger", {
            method: "POST",
            body: JSON.stringify({ source, repo, token }),
        }),
};

// Logging
export const logApi = {
    send: (level: string, message: string, context?: any) =>
        fetch("/api/client-log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ level, message, context, ts: new Date().toISOString() }),
        }).catch(() => null),
};
