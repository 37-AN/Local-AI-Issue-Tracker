"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Tables } from "@/database.types";

type NavKey = "dashboard" | "tickets" | "sops";

type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";
type TicketType = "Incident" | "Service Request" | "Problem" | "Change";
type TicketPriority = "P1" | "P2" | "P3" | "P4";

type TicketRow = Tables<"tickets">;
type TicketEventRow = Tables<"ticket_events">;

type SOP = {
  id: string;
  title: string;
  version: string;
  updatedAtISO: string;
  status: "Draft" | "Approved";
  tags: string[];
};

type RagResult = {
  id: string;
  source_type: string;
  source_id: string;
  chunk_index: number;
  title: string;
  content: string;
  metadata: unknown;
  score: number;
};

type EvidenceItem = {
  ref: string;
  source_type: string;
  source_id: string;
  title: string;
  score: number;
  content: string;
};

type AiSuggestion =
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

type SopDraft =
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

function isRaw(v: AiSuggestion | SopDraft): v is { raw: string } {
  return typeof (v as { raw?: unknown })?.raw === "string";
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatCompactDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const toneCls =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : tone === "warning"
      ? "bg-amber-50 text-amber-800 ring-amber-100"
      : tone === "danger"
      ? "bg-rose-50 text-rose-700 ring-rose-100"
      : tone === "info"
      ? "bg-sky-50 text-sky-700 ring-sky-100"
      : "bg-slate-50 text-slate-700 ring-slate-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

function Panel({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-900">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>
      {hint ? <div className="mt-2 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10">
      <div className="max-w-xl">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-2 text-sm text-slate-600">{description}</div>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

export default function Home() {
  const [nav, setNav] = useState<NavKey>("tickets");

  // UI-only (no backend yet): keep lists empty to avoid fake data.
  const sops: SOP[] = [];

  const TOPICS: readonly string[] = [
    "MES",
    "MES Development",
    "TrakSYS MES",
    "Networks",
    "Wi‑Fi",
    "APs",
    "VMS",
    "HOSTS",
    "SQL",
    "Databases",
    "Backups",
    "Active Directory",
    "DNS",
    "DHCP",
    "VPN",
    "Firewalls",
    "Switches",
    "Windows Servers",
    "Linux",
    "VMware / Virtualization",
    "Kubernetes",
    "Monitoring",
    "Logs",
    "Desktops Support",
    "Printers",
    "Email",
    "Certificates",
    "Patch Management",
    "Storage (SAN/NAS)",
    "SCADA / PLC",
    "Historian",
    "ERP Integrations",
  ] as const;

  const [topicQuery, setTopicQuery] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(
    () => new Set()
  );

  const visibleTopics = useMemo(() => {
    const q = topicQuery.trim().toLowerCase();
    if (!q) return TOPICS;
    return TOPICS.filter((t) => t.toLowerCase().includes(q));
  }, [topicQuery, TOPICS]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  const clearTopics = () => setSelectedTopics(new Set());

  const [ticketQuery, setTicketQuery] = useState("");
  const [ticketStatus, setTicketStatus] = useState<TicketStatus | "All">("All");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const [ticketsStatus, setTicketsStatus] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "loaded" }
    | { state: "error"; message: string }
  >({ state: "idle" });

  const [tickets, setTickets] = useState<TicketRow[]>([]);

  const [eventsStatus, setEventsStatus] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "loaded" }
    | { state: "error"; message: string }
  >({ state: "idle" });

  const [ticketEvents, setTicketEvents] = useState<TicketEventRow[]>([]);

  const selectedTicket = useMemo(() => {
    if (!selectedTicketId) return null;
    return tickets.find((t) => t.id === selectedTicketId) ?? null;
  }, [tickets, selectedTicketId]);

  const [editTicket, setEditTicket] = useState<{
    title: string;
    description: string;
    resolutionNotes: string;
    type: TicketType;
    priority: TicketPriority;
    service: string;
    site: string;
  } | null>(null);

  const [saveStatus, setSaveStatus] = useState<
    | { state: "idle" }
    | { state: "saving" }
    | { state: "saved" }
    | { state: "error"; message: string }
  >({ state: "idle" });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{
    externalId: string;
    title: string;
    description: string;
    type: TicketType;
    priority: TicketPriority;
    service: string;
    site: string;
  }>({
    externalId: "",
    title: "",
    description: "",
    type: "Incident",
    priority: "P3",
    service: "",
    site: "",
  });

  const [createStatus, setCreateStatus] = useState<
    | { state: "idle" }
    | { state: "creating" }
    | { state: "created" }
    | { state: "error"; message: string }
  >({ state: "idle" });

  async function loadTickets() {
    setTicketsStatus({ state: "loading" });

    const topicsParam =
      selectedTopics.size > 0 ? Array.from(selectedTopics).join(",") : "";

    const params = new URLSearchParams();
    if (ticketStatus !== "All") params.set("status", ticketStatus);
    if (ticketQuery.trim()) params.set("q", ticketQuery.trim());
    if (topicsParam) params.set("topics", topicsParam);

    try {
      const res = await fetch(`/api/tickets?${params.toString()}`, { method: "GET" });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof (json as { error?: unknown })?.error === "string"
            ? (json as { error: string }).error
            : "Failed to load tickets";
        setTicketsStatus({ state: "error", message: msg });
        return;
      }

      const data = Array.isArray((json as { tickets?: unknown })?.tickets)
        ? ((json as { tickets: TicketRow[] }).tickets ?? [])
        : [];
      setTickets(data);
      setTicketsStatus({ state: "loaded" });

      if (data.length > 0 && !selectedTicketId) {
        setSelectedTicketId(data[0]!.id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load tickets";
      setTicketsStatus({ state: "error", message: msg });
    }
  }

  async function loadEvents(ticketId: string) {
    setEventsStatus({ state: "loading" });
    setTicketEvents([]);

    try {
      const res = await fetch(`/api/tickets/${ticketId}/events`, { method: "GET" });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof (json as { error?: unknown })?.error === "string"
            ? (json as { error: string }).error
            : "Failed to load events";
        setEventsStatus({ state: "error", message: msg });
        return;
      }

      const data = Array.isArray((json as { events?: unknown })?.events)
        ? ((json as { events: TicketEventRow[] }).events ?? [])
        : [];
      setTicketEvents(data);
      setEventsStatus({ state: "loaded" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load events";
      setEventsStatus({ state: "error", message: msg });
    }
  }

  async function createTicket() {
    setCreateStatus({ state: "creating" });
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          externalId: createForm.externalId || undefined,
          title: createForm.title,
          description: createForm.description,
          type: createForm.type,
          priority: createForm.priority,
          service: createForm.service || undefined,
          site: createForm.site || undefined,
          topics: Array.from(selectedTopics),
        }),
      });

      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof (json as { error?: unknown })?.error === "string"
            ? (json as { error: string }).error
            : "Failed to create ticket";
        setCreateStatus({ state: "error", message: msg });
        return;
      }

      const ticket = (json as { ticket?: unknown })?.ticket as TicketRow | undefined;
      if (ticket) {
        setCreateStatus({ state: "created" });
        setCreateOpen(false);
        setCreateForm((p) => ({ ...p, title: "", description: "", externalId: "" }));
        await loadTickets();
        setSelectedTicketId(ticket.id);
      } else {
        setCreateStatus({ state: "error", message: "Ticket not returned" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create ticket";
      setCreateStatus({ state: "error", message: msg });
    }
  }

  async function saveTicketEdits(ticketId: string) {
    if (!editTicket) return;
    setSaveStatus({ state: "saving" });

    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: editTicket.title,
          description: editTicket.description,
          resolutionNotes: editTicket.resolutionNotes,
          type: editTicket.type,
          priority: editTicket.priority,
          service: editTicket.service,
          site: editTicket.site,
          topics: Array.from(selectedTopics),
        }),
      });

      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof (json as { error?: unknown })?.error === "string"
            ? (json as { error: string }).error
            : "Failed to save ticket";
        setSaveStatus({ state: "error", message: msg });
        return;
      }

      const ticket = (json as { ticket?: unknown })?.ticket as TicketRow | undefined;
      if (ticket) {
        setSaveStatus({ state: "saved" });
        setTickets((prev) => prev.map((t) => (t.id === ticket.id ? ticket : t)));
        await loadEvents(ticket.id);
        setTimeout(() => setSaveStatus({ state: "idle" }), 1200);
      } else {
        setSaveStatus({ state: "error", message: "Ticket not returned" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save ticket";
      setSaveStatus({ state: "error", message: msg });
    }
  }

  async function setTicketStatus(ticketId: string, status: TicketStatus) {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof (json as { error?: unknown })?.error === "string"
            ? (json as { error: string }).error
            : "Failed to update status";
        alert(msg);
        return;
      }

      const ticket = (json as { ticket?: unknown })?.ticket as TicketRow | undefined;
      if (ticket) {
        setTickets((prev) => prev.map((t) => (t.id === ticket.id ? ticket : t)));
        await loadEvents(ticket.id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update status";
      alert(msg);
    }
  }

  useEffect(() => {
    if (nav !== "tickets") return;
    void loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, ticketStatus, ticketQuery, selectedTopics]);

  useEffect(() => {
    if (!selectedTicketId) return;
    void loadEvents(selectedTicketId);
  }, [selectedTicketId]);

  useEffect(() => {
    if (!selectedTicket) {
      setEditTicket(null);
      return;
    }
    setEditTicket({
      title: selectedTicket.title,
      description: selectedTicket.description ?? "",
      resolutionNotes: selectedTicket.resolution_notes ?? "",
      type: selectedTicket.type as TicketType,
      priority: selectedTicket.priority as TicketPriority,
      service: selectedTicket.service ?? "",
      site: selectedTicket.site ?? "",
    });
    setSaveStatus({ state: "idle" });
  }, [selectedTicket]);

  const visibleTickets = useMemo(() => {
    // Server-side filtering is applied; just keep sort stable.
    return [...tickets].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  }, [tickets]);

  const [sopQuery, setSopQuery] = useState("");
  const visibleSOPs = useMemo(() => {
    const q = sopQuery.trim().toLowerCase();
    if (!q) return sops;
    return sops.filter((s) => {
      return (
        s.title.toLowerCase().includes(q) ||
        s.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [sops, sopQuery]);

  const [ragAdd, setRagAdd] = useState<{
    sourceType: string;
    sourceId: string;
    title: string;
    content: string;
  }>({
    sourceType: "ticket",
    sourceId: "",
    title: "",
    content: "",
  });

  const [ragAddStatus, setRagAddStatus] = useState<
    | { state: "idle" }
    | { state: "saving" }
    | { state: "saved"; chunksUpserted: number }
    | { state: "error"; message: string }
  >({ state: "idle" });

  const [ragQuery, setRagQuery] = useState("");
  const [ragFilterSourceType, setRagFilterSourceType] = useState<string>("all");
  const [ragResults, setRagResults] = useState<RagResult[]>([]);
  const [ragSearchStatus, setRagSearchStatus] = useState<
    | { state: "idle" }
    | { state: "searching" }
    | { state: "done" }
    | { state: "error"; message: string }
  >({ state: "idle" });

  const [dupTitle, setDupTitle] = useState("");
  const [dupDesc, setDupDesc] = useState("");
  const [dupStatus, setDupStatus] = useState<
    | { state: "idle" }
    | { state: "checking" }
    | { state: "done" }
    | { state: "error"; message: string }
  >({ state: "idle" });
  const [dupResults, setDupResults] = useState<RagResult[]>([]);

  const [aiHealth, setAiHealth] = useState<
    | { state: "idle" }
    | { state: "checking" }
    | { state: "ok"; host: string }
    | { state: "down"; host: string }
  >({ state: "idle" });

  const [aiTitle, setAiTitle] = useState("");
  const [aiDescription, setAiDescription] = useState("");

  const [aiSuggestStatus, setAiSuggestStatus] = useState<
    | { state: "idle" }
    | { state: "running" }
    | { state: "done" }
    | { state: "error"; message: string }
  >({ state: "idle" });

  const [aiSuggestEvidence, setAiSuggestEvidence] = useState<EvidenceItem[]>([]);
  const [aiSuggestResult, setAiSuggestResult] = useState<AiSuggestion | null>(null);

  const [sopResolutionNotes, setSopResolutionNotes] = useState("");
  const [sopValidationNotes, setSopValidationNotes] = useState("");
  const [sopRollbackNotes, setSopRollbackNotes] = useState("");

  const [sopStatus, setSopStatus] = useState<
    | { state: "idle" }
    | { state: "running" }
    | { state: "done" }
    | { state: "error"; message: string }
  >({ state: "idle" });

  const [sopEvidence, setSopEvidence] = useState<EvidenceItem[]>([]);
  const [sopDraft, setSopDraft] = useState<SopDraft | null>(null);

  const grafanaDashboardUrl =
    process.env.NEXT_PUBLIC_GRAFANA_DASHBOARD_URL ?? "";

  async function storeRagItem() {
    setRagAddStatus({ state: "saving" });
    try {
      const res = await fetch("/api/rag/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceType: ragAdd.sourceType,
          sourceId: ragAdd.sourceId,
          title: ragAdd.title,
          content: ragAdd.content,
          metadata: { topics: Array.from(selectedTopics) },
        }),
      });

      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof (json as { error?: unknown })?.error === "string"
            ? (json as { error: string }).error
            : "Failed to store item";
        setRagAddStatus({ state: "error", message: msg });
        return;
      }

      const chunksUpserted =
        typeof (json as { chunksUpserted?: unknown })?.chunksUpserted === "number"
          ? (json as { chunksUpserted: number }).chunksUpserted
          : 0;

      setRagAddStatus({ state: "saved", chunksUpserted });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to store item";
      setRagAddStatus({ state: "error", message: msg });
    }
  }

  async function runRagSearch() {
    setRagSearchStatus({ state: "searching" });
    setRagResults([]);
    try {
      const res = await fetch("/api/rag/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: ragQuery,
          limit: 8,
          filterSourceType:
            ragFilterSourceType === "all" ? null : ragFilterSourceType,
        }),
      });

      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof (json as { error?: unknown })?.error === "string"
            ? (json as { error: string }).error
            : "Search failed";
        setRagSearchStatus({ state: "error", message: msg });
        return;
      }

      const results = Array.isArray((json as { results?: unknown })?.results)
        ? ((json as { results: RagResult[] }).results ?? [])
        : [];

      setRagResults(results);
      setRagSearchStatus({ state: "done" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Search failed";
      setRagSearchStatus({ state: "error", message: msg });
    }
  }

  async function runDuplicateCheck() {
    setDupStatus({ state: "checking" });
    setDupResults([]);
    try {
      const res = await fetch("/api/rag/similar-tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: dupTitle, description: dupDesc, limit: 8 }),
      });

      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof (json as { error?: unknown })?.error === "string"
            ? (json as { error: string }).error
            : "Duplicate check failed";
        setDupStatus({ state: "error", message: msg });
        return;
      }

      const results = Array.isArray((json as { results?: unknown })?.results)
        ? ((json as { results: RagResult[] }).results ?? [])
        : [];

      setDupResults(results);
      setDupStatus({ state: "done" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Duplicate check failed";
      setDupStatus({ state: "error", message: msg });
    }
  }

  async function checkAiHealth() {
    setAiHealth({ state: "checking" });
    try {
      const res = await fetch("/api/ai/health", { method: "GET" });
      const json: unknown = await res.json();
      const ok = Boolean((json as { ok?: unknown })?.ok);
      const host =
        typeof (json as { host?: unknown })?.host === "string"
          ? (json as { host: string }).host
          : "unknown";

      setAiHealth(ok ? { state: "ok", host } : { state: "down", host });
    } catch {
      setAiHealth({ state: "down", host: "unknown" });
    }
  }

  async function runAiSuggest() {
    setAiSuggestStatus({ state: "running" });
    setAiSuggestEvidence([]);
    setAiSuggestResult(null);

    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: aiTitle,
          description: aiDescription,
          topics: Array.from(selectedTopics),
        }),
      });

      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof (json as { error?: unknown })?.error === "string"
            ? (json as { error: string }).error
            : "AI request failed";
        setAiSuggestStatus({ state: "error", message: msg });
        return;
      }

      const evidence = Array.isArray((json as { evidence?: unknown })?.evidence)
        ? ((json as { evidence: EvidenceItem[] }).evidence ?? [])
        : [];
      const suggestion = (json as { suggestion?: unknown })?.suggestion as
        | AiSuggestion
        | undefined;

      setAiSuggestEvidence(evidence);
      setAiSuggestResult(suggestion ?? { raw: "" });
      setAiSuggestStatus({ state: "done" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI request failed";
      setAiSuggestStatus({ state: "error", message: msg });
    }
  }

  async function runSopDraft() {
    setSopStatus({ state: "running" });
    setSopEvidence([]);
    setSopDraft(null);

    try {
      const res = await fetch("/api/ai/sop-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticketTitle: aiTitle,
          ticketDescription: aiDescription,
          resolutionNotes: sopResolutionNotes,
          validationNotes: sopValidationNotes,
          rollbackNotes: sopRollbackNotes,
          topics: Array.from(selectedTopics),
        }),
      });

      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof (json as { error?: unknown })?.error === "string"
            ? (json as { error: string }).error
            : "SOP draft request failed";
        setSopStatus({ state: "error", message: msg });
        return;
      }

      const evidence = Array.isArray((json as { evidence?: unknown })?.evidence)
        ? ((json as { evidence: EvidenceItem[] }).evidence ?? [])
        : [];
      const sop = (json as { sop?: unknown })?.sop as SopDraft | undefined;

      setSopEvidence(evidence);
      setSopDraft(sop ?? { raw: "" });
      setSopStatus({ state: "done" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "SOP draft request failed";
      setSopStatus({ state: "error", message: msg });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-4 w-4 rounded bg-slate-900" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-900">
                IT Issue Tracker
              </h1>
              <p className="truncate text-xs text-slate-600">
                Privacy-first, local-first incident operations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden w-[440px] sm:block">
              <label className="sr-only" htmlFor="global-search">
                Search
              </label>
              <div className="relative">
                <input
                  id="global-search"
                  type="search"
                  placeholder="Search tickets, SOPs, services…"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                  value={nav === "sops" ? sopQuery : ticketQuery}
                  onChange={(e) =>
                    nav === "sops"
                      ? setSopQuery(e.target.value)
                      : setTicketQuery(e.target.value)
                  }
                />
                <div className="pointer-events-none absolute right-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-slate-300" />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="h-7 w-7 rounded-full bg-slate-200" />
              <div className="hidden sm:block">
                <div className="text-xs font-medium text-slate-900">Local</div>
                <div className="text-[11px] text-slate-500">No telemetry</div>
              </div>
            </div>
          </div>
        </header>

        {/* Shell */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
          {/* Sidebar */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setNav("dashboard")}
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition",
                  nav === "dashboard"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setNav("tickets")}
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition",
                  nav === "tickets"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                Tickets
              </button>
              <button
                type="button"
                onClick={() => setNav("sops")}
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition",
                  nav === "sops"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                SOP Library
              </button>
            </nav>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-xs font-semibold text-slate-900">
                AI Assistant
              </div>
              <div className="mt-1 text-xs text-slate-600">
                UI scaffolding only. Local RAG + local LLM will be added next
                steps.
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Badge tone="neutral">Offline</Badge>
                <span className="text-[11px] text-slate-500">No keys</span>
              </div>
            </div>

            {/* Topics */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-slate-900">
                  Topics
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                  onClick={clearTopics}
                >
                  Clear
                </button>
              </div>

              <div className="mt-3">
                <label className="sr-only" htmlFor="topic-search">
                  Search topics
                </label>
                <input
                  id="topic-search"
                  type="search"
                  placeholder="Filter topics…"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                  value={topicQuery}
                  onChange={(e) => setTopicQuery(e.target.value)}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {visibleTopics.slice(0, 18).map((topic) => {
                  const active = selectedTopics.has(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition",
                        active
                          ? "bg-slate-900 text-white ring-slate-900"
                          : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 text-[11px] text-slate-500">
                Selected: {selectedTopics.size}
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="space-y-5">
            {nav === "dashboard" ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Open tickets"
                    value="—"
                    hint="Connect ticket data source"
                  />
                  <StatCard
                    label="MTTR"
                    value="—"
                    hint="Requires historical resolution timestamps"
                  />
                  <StatCard
                    label="AI success rate"
                    value="—"
                    hint="Based on engineer feedback (1–5)"
                  />
                  <StatCard
                    label="Recurring issues"
                    value="—"
                    hint="Computed via similarity + clustering"
                  />
                </div>

                <Panel
                  title="Operational overview"
                  subtitle="Enterprise-friendly dashboard layout (no placeholder charts)."
                >
                  <EmptyState
                    title="No metrics available yet"
                    description="In a later step, we'll integrate Prometheus/Grafana and populate these panels with real measurements (MTTR, frequency, SOP usage, and AI accuracy)."
                  />
                </Panel>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <Panel
                    title="Recent activity"
                    subtitle="Ticket updates, SOP approvals, and audits will appear here."
                  >
                    <EmptyState
                      title="No activity"
                      description="Once ingestion and audit logging are wired up, you'll see a chronological activity stream."
                    />
                  </Panel>
                  <Panel
                    title="Top services"
                    subtitle="Ranked by incident volume and impact."
                  >
                    <EmptyState
                      title="No service data"
                      description="Service mapping will be derived from tickets, monitoring labels, and integrations."
                    />
                  </Panel>
                </div>

                <Panel
                  title="Observability"
                  subtitle="Prometheus metrics endpoint and optional Grafana dashboard embedding."
                >
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold text-slate-900">
                        Prometheus scrape endpoint
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        Exposes real runtime metrics (API request rates, latency,
                        RAG operations, AI operations).
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                        <div className="text-xs font-semibold text-slate-900">
                          Endpoint
                        </div>
                        <div className="mt-2 font-mono text-xs text-slate-700">
                          /api/metrics
                        </div>
                        <div className="mt-3 text-xs text-slate-600">
                          Prometheus example:
                        </div>
                        <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-slate-800 ring-1 ring-inset ring-slate-200">
{`scrape_configs:
  - job_name: it-issue-tracker
    metrics_path: /api/metrics
    static_configs:
      - targets: ["<app-host>:3000"]`}
                        </pre>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold text-slate-900">
                        Grafana dashboard
                      </div>
                      {grafanaDashboardUrl ? (
                        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                          <iframe
                            title="Grafana Dashboard"
                            src={grafanaDashboardUrl}
                            className="h-[420px] w-full bg-white"
                          />
                        </div>
                      ) : (
                        <div className="mt-3">
                          <EmptyState
                            title="Grafana not configured"
                            description="Set NEXT_PUBLIC_GRAFANA_DASHBOARD_URL to embed an internal Grafana dashboard (no placeholder charts here)."
                          />
                        </div>
                      )}
                      {grafanaDashboardUrl ? (
                        <div className="mt-3 text-xs text-slate-500">
                          Embedded URL:{" "}
                          <span className="font-mono">{grafanaDashboardUrl}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Panel>

                <Panel
                  title="RAG memory (local vector store)"
                  subtitle="Store internal knowledge as embeddings and retrieve relevant context via similarity search."
                >
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold text-slate-900">
                        Store item
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="text-xs font-medium text-slate-600">
                              Source type
                            </label>
                            <select
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                              value={ragAdd.sourceType}
                              onChange={(e) =>
                                setRagAdd((p) => ({ ...p, sourceType: e.target.value }))
                              }
                            >
                              <option value="ticket">ticket</option>
                              <option value="sop">sop</option>
                              <option value="postmortem">postmortem</option>
                              <option value="note">note</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600">
                              Source ID
                            </label>
                            <input
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                              placeholder="e.g. INC-10422"
                              value={ragAdd.sourceId}
                              onChange={(e) =>
                                setRagAdd((p) => ({ ...p, sourceId: e.target.value }))
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Title
                          </label>
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            placeholder="Short summary"
                            value={ragAdd.title}
                            onChange={(e) =>
                              setRagAdd((p) => ({ ...p, title: e.target.value }))
                            }
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Content
                          </label>
                          <textarea
                            className="mt-1 h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            placeholder="Paste resolution notes, SOP sections, symptoms, logs (sanitized), etc."
                            value={ragAdd.content}
                            onChange={(e) =>
                              setRagAdd((p) => ({ ...p, content: e.target.value }))
                            }
                          />
                          <div className="mt-2 text-[11px] text-slate-500">
                            Topics applied: {selectedTopics.size > 0 ? Array.from(selectedTopics).join(", ") : "none"}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-600">
                            {ragAddStatus.state === "saved"
                              ? `Stored (${ragAddStatus.chunksUpserted} chunks)`
                              : ragAddStatus.state === "error"
                              ? ragAddStatus.message
                              : "Embeddings are generated locally."}
                          </div>
                          <button
                            type="button"
                            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={
                              ragAddStatus.state === "saving" ||
                              !ragAdd.sourceId.trim() ||
                              !ragAdd.title.trim() ||
                              !ragAdd.content.trim()
                            }
                            onClick={storeRagItem}
                          >
                            {ragAddStatus.state === "saving" ? "Storing…" : "Store"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold text-slate-900">
                        Search memory
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
                          <input
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            placeholder="Ask: 'TrakSYS MES client won't connect'…"
                            value={ragQuery}
                            onChange={(e) => setRagQuery(e.target.value)}
                          />
                          <select
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            value={ragFilterSourceType}
                            onChange={(e) => setRagFilterSourceType(e.target.value)}
                          >
                            <option value="all">All</option>
                            <option value="ticket">ticket</option>
                            <option value="sop">sop</option>
                            <option value="postmortem">postmortem</option>
                            <option value="note">note</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-600">
                            {ragSearchStatus.state === "error"
                              ? ragSearchStatus.message
                              : ragSearchStatus.state === "done"
                              ? `${ragResults.length} results`
                              : "Cosine similarity over local embeddings."}
                          </div>
                          <button
                            type="button"
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={ragSearchStatus.state === "searching" || !ragQuery.trim()}
                            onClick={runRagSearch}
                          >
                            {ragSearchStatus.state === "searching" ? "Searching…" : "Search"}
                          </button>
                        </div>

                        <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200">
                          {ragResults.length === 0 ? (
                            <div className="p-4 text-sm text-slate-600">
                              No results yet. Store an item, then search.
                            </div>
                          ) : (
                            <ul className="divide-y divide-slate-200">
                              {ragResults.map((r) => (
                                <li key={r.id} className="p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-medium text-slate-900">
                                        {r.title}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        <span className="font-mono">{r.source_type}</span>
                                        <span className="text-slate-300"> • </span>
                                        <span className="font-mono">{r.source_id}</span>
                                        <span className="text-slate-300"> • </span>
                                        <span>chunk {r.chunk_index}</span>
                                      </div>
                                      <div className="mt-2 line-clamp-3 text-sm text-slate-600">
                                        {r.content}
                                      </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <Badge tone="neutral">
                                        score {r.score.toFixed(3)}
                                      </Badge>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>

                <Panel
                  title="Local LLM workbench"
                  subtitle="Grounded suggestions and SOP drafts using local RAG evidence + a local model (Ollama optional)."
                  right={
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
                      onClick={checkAiHealth}
                    >
                      {aiHealth.state === "checking"
                        ? "Checking…"
                        : aiHealth.state === "ok"
                        ? "LLM: Online"
                        : aiHealth.state === "down"
                        ? "LLM: Offline"
                        : "Check LLM"}
                    </button>
                  }
                >
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold text-slate-900">
                        Issue analysis (AI suggestions)
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Title
                          </label>
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            placeholder="e.g. TrakSYS MES client fails to connect"
                            value={aiTitle}
                            onChange={(e) => setAiTitle(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Description / symptoms
                          </label>
                          <textarea
                            className="mt-1 h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            placeholder="Include exact errors, impacted hosts, time window, recent changes…"
                            value={aiDescription}
                            onChange={(e) => setAiDescription(e.target.value)}
                          />
                          <div className="mt-2 text-[11px] text-slate-500">
                            Topics applied:{" "}
                            {selectedTopics.size > 0
                              ? Array.from(selectedTopics).join(", ")
                              : "none"}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-600">
                            {aiSuggestStatus.state === "error"
                              ? aiSuggestStatus.message
                              : "Suggestions are grounded in retrieved evidence only."}
                          </div>
                          <button
                            type="button"
                            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={
                              aiSuggestStatus.state === "running" || !aiTitle.trim()
                            }
                            onClick={runAiSuggest}
                          >
                            {aiSuggestStatus.state === "running"
                              ? "Running…"
                              : "Generate suggestions"}
                          </button>
                        </div>

                        {aiSuggestResult ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs font-semibold text-slate-900">
                                Output
                              </div>
                              {!isRaw(aiSuggestResult) &&
                              typeof aiSuggestResult.confidence_overall === "number" ? (
                                <Badge tone="neutral">
                                  confidence {aiSuggestResult.confidence_overall.toFixed(2)}
                                </Badge>
                              ) : null}
                            </div>

                            {isRaw(aiSuggestResult) ? (
                              <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-800">
                                {aiSuggestResult.raw}
                              </pre>
                            ) : (
                              <div className="mt-3 space-y-4">
                                <div className="text-sm text-slate-800">
                                  {aiSuggestResult.summary}
                                </div>

                                <div>
                                  <div className="text-xs font-semibold text-slate-900">
                                    Recommended steps
                                  </div>
                                  <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-slate-800">
                                    {aiSuggestResult.recommended_steps.map((s, i) => (
                                      <li key={i}>
                                        <div className="font-medium">{s.step}</div>
                                        <div className="mt-1 text-xs text-slate-600">
                                          {s.rationale}{" "}
                                          {s.evidence_refs?.length ? (
                                            <span className="font-mono">
                                              ({s.evidence_refs.join(", ")})
                                            </span>
                                          ) : null}
                                        </div>
                                      </li>
                                    ))}
                                  </ol>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div>
                                    <div className="text-xs font-semibold text-slate-900">
                                      Validation
                                    </div>
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
                                      {aiSuggestResult.validation_steps.map((v, i) => (
                                        <li key={i}>{v}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-slate-900">
                                      Rollback
                                    </div>
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
                                      {aiSuggestResult.rollback_procedures.map((v, i) => (
                                        <li key={i}>{v}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>

                                {aiSuggestResult.questions.length ? (
                                  <div>
                                    <div className="text-xs font-semibold text-slate-900">
                                      Questions (missing evidence)
                                    </div>
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
                                      {aiSuggestResult.questions.map((q, i) => (
                                        <li key={i}>{q}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ) : null}

                        <div className="rounded-2xl border border-slate-200">
                          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                            <div className="text-xs font-semibold text-slate-900">
                              Evidence used
                            </div>
                            <div className="text-xs text-slate-500">
                              {aiSuggestEvidence.length} items
                            </div>
                          </div>
                          {aiSuggestEvidence.length === 0 ? (
                            <div className="p-4 text-sm text-slate-600">
                              Store internal ticket/SOP knowledge in the RAG memory panel first.
                            </div>
                          ) : (
                            <ul className="divide-y divide-slate-200">
                              {aiSuggestEvidence.map((e) => (
                                <li key={e.ref} className="p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-medium text-slate-900">
                                        {e.ref}: {e.title}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        <span className="font-mono">
                                          {e.source_type}:{e.source_id}
                                        </span>{" "}
                                        • score {e.score.toFixed(3)}
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold text-slate-900">
                        SOP draft generation (after resolution)
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Resolution notes (required)
                          </label>
                          <textarea
                            className="mt-1 h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            placeholder="What was done to resolve the issue (commands, config changes, restarts, approvals, etc.)"
                            value={sopResolutionNotes}
                            onChange={(e) => setSopResolutionNotes(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="text-xs font-medium text-slate-600">
                              Validation notes (optional)
                            </label>
                            <textarea
                              className="mt-1 h-20 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                              placeholder="How you verified recovery"
                              value={sopValidationNotes}
                              onChange={(e) => setSopValidationNotes(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600">
                              Rollback notes (optional)
                            </label>
                            <textarea
                              className="mt-1 h-20 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                              placeholder="How to revert safely"
                              value={sopRollbackNotes}
                              onChange={(e) => setSopRollbackNotes(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-600">
                            {sopStatus.state === "error"
                              ? sopStatus.message
                              : "Draft is grounded in RAG evidence + your resolution notes."}
                          </div>
                          <button
                            type="button"
                            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={
                              sopStatus.state === "running" ||
                              !aiTitle.trim() ||
                              !sopResolutionNotes.trim()
                            }
                            onClick={runSopDraft}
                          >
                            {sopStatus.state === "running" ? "Generating…" : "Generate SOP draft"}
                          </button>
                        </div>

                        {sopDraft ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                            <div className="text-xs font-semibold text-slate-900">
                              SOP draft
                            </div>
                            {isRaw(sopDraft) ? (
                              <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-800">
                                {sopDraft.raw}
                              </pre>
                            ) : (
                              <div className="mt-3 space-y-4 text-sm text-slate-800">
                                <div>
                                  <div className="text-xs font-semibold text-slate-900">
                                    Problem
                                  </div>
                                  <div className="mt-1">{sopDraft.problem_description}</div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div>
                                    <div className="text-xs font-semibold text-slate-900">
                                      Symptoms
                                    </div>
                                    <ul className="mt-2 list-disc space-y-1 pl-5">
                                      {sopDraft.symptoms.map((s, i) => (
                                        <li key={i}>{s}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-slate-900">
                                      Root cause
                                    </div>
                                    <div className="mt-2">{sopDraft.root_cause}</div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                  <div className="sm:col-span-2">
                                    <div className="text-xs font-semibold text-slate-900">
                                      Resolution steps
                                    </div>
                                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                                      {sopDraft.resolution_steps.map((s, i) => (
                                        <li key={i}>{s}</li>
                                      ))}
                                    </ol>
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-slate-900">
                                      References
                                    </div>
                                    <div className="mt-2 font-mono text-xs text-slate-600">
                                      {sopDraft.references?.length
                                        ? sopDraft.references.join(", ")
                                        : "—"}
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div>
                                    <div className="text-xs font-semibold text-slate-900">
                                      Validation
                                    </div>
                                    <ul className="mt-2 list-disc space-y-1 pl-5">
                                      {sopDraft.validation_steps.map((s, i) => (
                                        <li key={i}>{s}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-slate-900">
                                      Rollback
                                    </div>
                                    <ul className="mt-2 list-disc space-y-1 pl-5">
                                      {sopDraft.rollback_procedures.map((s, i) => (
                                        <li key={i}>{s}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}

                        <div className="rounded-2xl border border-slate-200">
                          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                            <div className="text-xs font-semibold text-slate-900">
                              Evidence used
                            </div>
                            <div className="text-xs text-slate-500">
                              {sopEvidence.length} items
                            </div>
                          </div>
                          {sopEvidence.length === 0 ? (
                            <div className="p-4 text-sm text-slate-600">
                              Store internal ticket/SOP knowledge in RAG memory first.
                            </div>
                          ) : (
                            <ul className="divide-y divide-slate-200">
                              {sopEvidence.map((e) => (
                                <li key={e.ref} className="p-4">
                                  <div className="truncate text-sm font-medium text-slate-900">
                                    {e.ref}: {e.title}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    <span className="font-mono">
                                      {e.source_type}:{e.source_id}
                                    </span>{" "}
                                    • score {e.score.toFixed(3)}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-slate-500">
                    To enable the local LLM: run Ollama locally and set{" "}
                    <span className="font-mono">OLLAMA_MODEL</span> (default{" "}
                    <span className="font-mono">phi3:mini</span>). No cloud calls.
                  </div>
                </Panel>
              </>
            ) : null}

            {nav === "tickets" ? (
              <>
                <Panel
                  title="Tickets"
                  subtitle="Create, triage, and resolve incidents and requests."
                  right={
                    <button
                      type="button"
                      className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
                      onClick={() => {
                        setCreateOpen(true);
                        setCreateStatus({ state: "idle" });
                      }}
                    >
                      New ticket
                    </button>
                  }
                >
                  {createOpen ? (
                    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Create ticket
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            Topics will be set from your sidebar selection.
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
                          onClick={() => setCreateOpen(false)}
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Title
                          </label>
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            value={createForm.title}
                            onChange={(e) =>
                              setCreateForm((p) => ({ ...p, title: e.target.value }))
                            }
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            External ID (optional)
                          </label>
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            placeholder="e.g. INC-10422"
                            value={createForm.externalId}
                            onChange={(e) =>
                              setCreateForm((p) => ({ ...p, externalId: e.target.value }))
                            }
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Type
                          </label>
                          <select
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            value={createForm.type}
                            onChange={(e) =>
                              setCreateForm((p) => ({ ...p, type: e.target.value as TicketType }))
                            }
                          >
                            <option value="Incident">Incident</option>
                            <option value="Service Request">Service Request</option>
                            <option value="Problem">Problem</option>
                            <option value="Change">Change</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Priority
                          </label>
                          <select
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            value={createForm.priority}
                            onChange={(e) =>
                              setCreateForm((p) => ({
                                ...p,
                                priority: e.target.value as TicketPriority,
                              }))
                            }
                          >
                            <option value="P1">P1</option>
                            <option value="P2">P2</option>
                            <option value="P3">P3</option>
                            <option value="P4">P4</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Service (optional)
                          </label>
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            value={createForm.service}
                            onChange={(e) =>
                              setCreateForm((p) => ({ ...p, service: e.target.value }))
                            }
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Site (optional)
                          </label>
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            value={createForm.site}
                            onChange={(e) =>
                              setCreateForm((p) => ({ ...p, site: e.target.value }))
                            }
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs font-medium text-slate-600">
                            Description
                          </label>
                          <textarea
                            className="mt-1 h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                            value={createForm.description}
                            onChange={(e) =>
                              setCreateForm((p) => ({ ...p, description: e.target.value }))
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="text-xs text-slate-600">
                          {createStatus.state === "error" ? createStatus.message : null}
                        </div>
                        <button
                          type="button"
                          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={createStatus.state === "creating" || !createForm.title.trim()}
                          onClick={createTicket}
                        >
                          {createStatus.state === "creating" ? "Creating…" : "Create"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="w-full sm:max-w-md">
                      <label className="sr-only" htmlFor="ticket-search">
                        Search tickets
                      </label>
                      <input
                        id="ticket-search"
                        type="search"
                        placeholder="Search by ID, title, service…"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                        value={ticketQuery}
                        onChange={(e) => setTicketQuery(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-600">
                        Status
                      </span>
                      <select
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                        value={ticketStatus}
                        onChange={(e) =>
                          setTicketStatus(e.target.value as TicketStatus | "All")
                        }
                      >
                        <option value="All">All</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  {/* Selected topics (context bar) */}
                  {selectedTopics.size > 0 ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-slate-600">
                        Topic filters
                      </span>
                      {Array.from(selectedTopics)
                        .slice(0, 10)
                        .map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleTopic(t)}
                            className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-inset ring-slate-900"
                            title="Remove"
                          >
                            {t}
                          </button>
                        ))}
                      <button
                        type="button"
                        className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-100"
                        onClick={clearTopics}
                      >
                        Clear all
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
                    {/* Ticket list */}
                    <div className="rounded-2xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                        <div className="text-xs font-semibold text-slate-900">
                          Queue
                        </div>
                        <div className="text-xs text-slate-500">
                          {ticketsStatus.state === "loading"
                            ? "Loading…"
                            : `${visibleTickets.length} items`}
                        </div>
                      </div>

                      {ticketsStatus.state === "error" ? (
                        <div className="p-4">
                          <EmptyState
                            title="Failed to load tickets"
                            description={ticketsStatus.message}
                            action={
                              <button
                                type="button"
                                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
                                onClick={loadTickets}
                              >
                                Retry
                              </button>
                            }
                          />
                        </div>
                      ) : visibleTickets.length === 0 ? (
                        <div className="p-4">
                          <EmptyState
                            title="No tickets"
                            description="Create the first ticket to start tracking incidents and requests."
                            action={
                              <button
                                type="button"
                                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
                                onClick={() => setCreateOpen(true)}
                              >
                                New ticket
                              </button>
                            }
                          />
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-200">
                          {visibleTickets.map((t) => (
                            <li key={t.id}>
                              <button
                                type="button"
                                className={cn(
                                  "w-full px-4 py-3 text-left transition hover:bg-slate-50",
                                  selectedTicketId === t.id ? "bg-slate-50" : ""
                                )}
                                onClick={() => setSelectedTicketId(t.id)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-slate-900">
                                      {t.title}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                      <span className="font-mono text-[11px] text-slate-500">
                                        {t.external_id ?? t.id.slice(0, 8)}
                                      </span>
                                      <span className="text-slate-300">•</span>
                                      <span>{t.type}</span>
                                      {t.service ? (
                                        <>
                                          <span className="text-slate-300">•</span>
                                          <span className="truncate">{t.service}</span>
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 flex-col items-end gap-2">
                                    <Badge
                                      tone={
                                        t.status === "Resolved" ||
                                        t.status === "Closed"
                                          ? "success"
                                          : t.status === "In Progress"
                                          ? "info"
                                          : "warning"
                                      }
                                    >
                                      {t.status}
                                    </Badge>
                                    <span className="text-[11px] text-slate-500">
                                      {formatCompactDate(t.updated_at)}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Ticket detail + AI panel */}
                    <div className="space-y-5">
                      <Panel
                        title="Ticket details"
                        subtitle="Triage and resolution workspace."
                      >
                        {selectedTicket && editTicket ? (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone="neutral">{selectedTicket.type}</Badge>
                              <Badge tone="neutral">Priority {selectedTicket.priority}</Badge>
                              <Badge
                                tone={
                                  selectedTicket.status === "Resolved" ||
                                  selectedTicket.status === "Closed"
                                    ? "success"
                                    : selectedTicket.status === "In Progress"
                                    ? "info"
                                    : "warning"
                                }
                              >
                                {selectedTicket.status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div>
                                <label className="text-xs font-medium text-slate-600">
                                  Title
                                </label>
                                <input
                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                  value={editTicket.title}
                                  onChange={(e) =>
                                    setEditTicket((p) => (p ? { ...p, title: e.target.value } : p))
                                  }
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-medium text-slate-600">
                                    Type
                                  </label>
                                  <select
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                    value={editTicket.type}
                                    onChange={(e) =>
                                      setEditTicket((p) =>
                                        p ? { ...p, type: e.target.value as TicketType } : p
                                      )
                                    }
                                  >
                                    <option value="Incident">Incident</option>
                                    <option value="Service Request">Service Request</option>
                                    <option value="Problem">Problem</option>
                                    <option value="Change">Change</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600">
                                    Priority
                                  </label>
                                  <select
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                    value={editTicket.priority}
                                    onChange={(e) =>
                                      setEditTicket((p) =>
                                        p
                                          ? { ...p, priority: e.target.value as TicketPriority }
                                          : p
                                      )
                                    }
                                  >
                                    <option value="P1">P1</option>
                                    <option value="P2">P2</option>
                                    <option value="P3">P3</option>
                                    <option value="P4">P4</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="text-xs font-medium text-slate-600">
                                  Service
                                </label>
                                <input
                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                  value={editTicket.service}
                                  onChange={(e) =>
                                    setEditTicket((p) =>
                                      p ? { ...p, service: e.target.value } : p
                                    )
                                  }
                                />
                              </div>

                              <div>
                                <label className="text-xs font-medium text-slate-600">
                                  Site
                                </label>
                                <input
                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                  value={editTicket.site}
                                  onChange={(e) =>
                                    setEditTicket((p) => (p ? { ...p, site: e.target.value } : p))
                                  }
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-medium text-slate-600">
                                Description
                              </label>
                              <textarea
                                className="mt-1 h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                value={editTicket.description}
                                onChange={(e) =>
                                  setEditTicket((p) =>
                                    p ? { ...p, description: e.target.value } : p
                                  )
                                }
                              />
                            </div>

                            <div>
                              <label className="text-xs font-medium text-slate-600">
                                Resolution notes
                              </label>
                              <textarea
                                className="mt-1 h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                                value={editTicket.resolutionNotes}
                                onChange={(e) =>
                                  setEditTicket((p) =>
                                    p ? { ...p, resolutionNotes: e.target.value } : p
                                  )
                                }
                              />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="text-xs text-slate-600">
                                {saveStatus.state === "error"
                                  ? saveStatus.message
                                  : saveStatus.state === "saved"
                                  ? "Saved"
                                  : null}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
                                  onClick={() => void saveTicketEdits(selectedTicket.id)}
                                  disabled={saveStatus.state === "saving"}
                                >
                                  {saveStatus.state === "saving" ? "Saving…" : "Save"}
                                </button>

                                <button
                                  type="button"
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
                                  onClick={() => void setTicketStatus(selectedTicket.id, "In Progress")}
                                >
                                  Set In Progress
                                </button>

                                <button
                                  type="button"
                                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
                                  onClick={() => void setTicketStatus(selectedTicket.id, "Resolved")}
                                >
                                  Resolve (stores to RAG)
                                </button>

                                <button
                                  type="button"
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
                                  onClick={() => void setTicketStatus(selectedTicket.id, "Closed")}
                                >
                                  Close
                                </button>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200">
                              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                                <div className="text-xs font-semibold text-slate-900">
                                  Timeline
                                </div>
                                <div className="text-xs text-slate-500">
                                  {eventsStatus.state === "loading"
                                    ? "Loading…"
                                    : `${ticketEvents.length} events`}
                                </div>
                              </div>

                              {eventsStatus.state === "error" ? (
                                <div className="p-4 text-sm text-slate-600">
                                  {eventsStatus.message}
                                </div>
                              ) : ticketEvents.length === 0 ? (
                                <div className="p-4 text-sm text-slate-600">
                                  No events yet.
                                </div>
                              ) : (
                                <ul className="divide-y divide-slate-200">
                                  {ticketEvents.map((ev) => (
                                    <li key={ev.id} className="px-4 py-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="text-sm font-medium text-slate-900">
                                            {ev.event_type}
                                            {ev.event_type === "status_changed" &&
                                            ev.from_status &&
                                            ev.to_status ? (
                                              <span className="text-slate-600">
                                                {" "}
                                                ({ev.from_status} → {ev.to_status})
                                              </span>
                                            ) : null}
                                          </div>
                                          <div className="mt-1 text-xs text-slate-500">
                                            {formatCompactDate(ev.created_at)}
                                          </div>
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        ) : (
                          <EmptyState
                            title="Select a ticket"
                            description="Choose an item from the queue to view and update details."
                          />
                        )}
                      </Panel>

                      <Panel
                        title="AI suggestions"
                        subtitle="Root cause hypotheses and step-by-step runbooks (grounded in local RAG)."
                        right={<Badge tone="neutral">Disabled</Badge>}
                      >
                        <EmptyState
                          title="AI assistant not connected"
                          description="In a later step, this panel will retrieve relevant prior resolutions and SOPs (RAG), then generate grounded suggestions using a local LLM—no external API calls."
                          action={
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="text-xs font-semibold text-slate-900">
                                  What will appear here
                                </div>
                                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                                  <li>• Probable root causes (with confidence)</li>
                                  <li>• Resolution steps based on prior fixes</li>
                                  <li>• Validation + rollback procedures</li>
                                </ul>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="text-xs font-semibold text-slate-900">
                                  Guardrails
                                </div>
                                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                                  <li>• Grounded in retrieved evidence only</li>
                                  <li>• Avoid repeats of failed solutions</li>
                                  <li>• Detect outdated SOP versions</li>
                                </ul>
                              </div>
                            </div>
                          }
                        />
                      </Panel>

                      <Panel
                        title="Engineer feedback"
                        subtitle="Rate and annotate recommendations to improve future results."
                      >
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                            <div className="text-xs font-semibold text-slate-900">
                              Rating
                            </div>
                            <div className="mt-2 flex gap-2">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
                                  onClick={() => {
                                    alert(
                                      "Feedback storage will be implemented in a later step."
                                    );
                                  }}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                            <div className="text-xs font-semibold text-slate-900">
                              Notes
                            </div>
                            <textarea
                              className="mt-2 h-20 w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                              placeholder="What worked, what didn't, missing context, links to logs…"
                              onChange={() => {
                                // UI-only
                              }}
                            />
                            <div className="mt-2 flex items-center justify-end">
                              <button
                                type="button"
                                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
                                onClick={() => {
                                  alert(
                                    "Feedback submission will be implemented in a later step."
                                  );
                                }}
                              >
                                Submit feedback
                              </button>
                            </div>
                          </div>
                        </div>
                      </Panel>
                    </div>
                  </div>
                </Panel>

                <Panel
                  title="Duplicate / similarity detection (local)"
                  subtitle="Checks if a new issue resembles previously stored ticket items in RAG memory."
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Title
                      </label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                        placeholder="e.g. TrakSYS MES client fails to connect"
                        value={dupTitle}
                        onChange={(e) => setDupTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Description (optional)
                      </label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                        placeholder="Symptoms, errors, affected service/site…"
                        value={dupDesc}
                        onChange={(e) => setDupDesc(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-600">
                      {dupStatus.state === "error"
                        ? dupStatus.message
                        : dupStatus.state === "done"
                        ? `${dupResults.length} similar items`
                        : "Uses cosine similarity over local embeddings."}
                    </div>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={dupStatus.state === "checking" || (!dupTitle.trim() && !dupDesc.trim())}
                      onClick={runDuplicateCheck}
                    >
                      {dupStatus.state === "checking" ? "Checking…" : "Check similarity"}
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200">
                    {dupResults.length === 0 ? (
                      <div className="p-4 text-sm text-slate-600">
                        No results. Store some ticket items under source type <span className="font-mono">ticket</span> in the Dashboard → RAG memory panel, then re-check.
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-200">
                        {dupResults.map((r) => (
                          <li key={r.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-slate-900">
                                  {r.title}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  <span className="font-mono">{r.source_id}</span>
                                  <span className="text-slate-300"> • </span>
                                  <span>chunk {r.chunk_index}</span>
                                </div>
                                <div className="mt-2 line-clamp-2 text-sm text-slate-600">
                                  {r.content}
                                </div>
                              </div>
                              <div className="shrink-0">
                                <Badge tone="neutral">score {r.score.toFixed(3)}</Badge>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Panel>
              </>
            ) : null}

            {nav === "sops" ? (
              <>
                <Panel
                  title="SOP Library"
                  subtitle="Search and manage standardized operating procedures."
                  right={
                    <button
                      type="button"
                      className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
                      onClick={() => {
                        alert("SOP generation and versioning will be added in a later step.");
                      }}
                    >
                      New SOP
                    </button>
                  }
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="w-full sm:max-w-md">
                      <label className="sr-only" htmlFor="sop-search">
                        Search SOPs
                      </label>
                      <input
                        id="sop-search"
                        type="search"
                        placeholder="Search SOPs by title or tags…"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
                        value={sopQuery}
                        onChange={(e) => setSopQuery(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">Versioned</Badge>
                      <Badge tone="neutral">Approval flow</Badge>
                    </div>
                  </div>

                  <div className="mt-5">
                    {visibleSOPs.length === 0 ? (
                      <EmptyState
                        title="No SOPs"
                        description="After tickets are resolved, the system will generate SOP drafts automatically. Engineers can review, edit, approve, and version them over time."
                        action={
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
                              onClick={() => setSopQuery("")}
                            >
                              Clear search
                            </button>
                            <button
                              type="button"
                              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
                              onClick={() => {
                                alert(
                                  "SOP generation will be implemented in a later step."
                                );
                              }}
                            >
                              Enable SOP generation
                            </button>
                          </div>
                        }
                      />
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-white">
                        <div className="grid grid-cols-[1fr_140px_140px] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-600">
                          <div>Title</div>
                          <div>Version</div>
                          <div>Updated</div>
                        </div>
                        <ul className="divide-y divide-slate-200">
                          {visibleSOPs.map((s) => (
                            <li key={s.id} className="px-4 py-3">
                              <div className="grid grid-cols-[1fr_140px_140px] items-center gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-slate-900">
                                    {s.title}
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    <Badge
                                      tone={s.status === "Approved" ? "success" : "warning"}
                                    >
                                      {s.status}
                                    </Badge>
                                    {s.tags.slice(0, 3).map((tag) => (
                                      <Badge key={tag} tone="neutral">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-sm text-slate-700">{s.version}</div>
                                <div className="text-sm text-slate-700">
                                  {formatCompactDate(s.updatedAtISO)}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Panel>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <Panel
                    title="SOP preview"
                    subtitle="Structured sections: symptoms, root cause, steps, validation, rollback."
                  >
                    <EmptyState
                      title="Nothing selected"
                      description="When SOPs are available, selecting one will show a structured preview here."
                    />
                  </Panel>

                  <Panel
                    title="Change history"
                    subtitle="Version diffs, approvals, and deprecation warnings."
                  >
                    <EmptyState
                      title="No history"
                      description="Once SOP versioning is implemented, you'll see approvals, diffs, and outdated SOP detection here."
                    />
                  </Panel>
                </div>
              </>
            ) : null}
          </main>
        </div>

        <footer className="mt-8 border-t border-slate-200 pt-4">
          <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div>Enterprise UI scaffolding • Local-only by design</div>
            <div className="font-mono">Next.js 15 • Tailwind</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
