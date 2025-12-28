import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

type TimerStop = () => number;

type MetricsBundle = {
  registry: Registry;

  httpRequestsTotal: Counter<"route" | "method" | "status">;
  httpRequestDurationSeconds: Histogram<"route" | "method" | "status">;

  ragUpsertRequestsTotal: Counter<"status">;
  ragUpsertChunksTotal: Counter<"status">;
  ragUpsertDurationSeconds: Histogram<"status">;

  ragSearchRequestsTotal: Counter<"status">;
  ragSearchResultsTotal: Counter<"status">;
  ragSearchDurationSeconds: Histogram<"status">;

  similarTicketsRequestsTotal: Counter<"status">;
  similarTicketsDurationSeconds: Histogram<"status">;

  aiSuggestRequestsTotal: Counter<"status">;
  aiSuggestEvidenceItemsTotal: Counter<"status">;
  aiSuggestDurationSeconds: Histogram<"status">;

  aiSopDraftRequestsTotal: Counter<"status">;
  aiSopDraftEvidenceItemsTotal: Counter<"status">;
  aiSopDraftDurationSeconds: Histogram<"status">;

  llmTokensTotal: Counter<"model" | "type">;
  llmLatencySeconds: Histogram<"model" | "status">;
};

function createMetrics(): MetricsBundle {
  const registry = new Registry();

  collectDefaultMetrics({
    register: registry,
    prefix: "it_tracker_",
  });

  const httpRequestsTotal = new Counter({
    name: "it_tracker_http_requests_total",
    help: "HTTP requests processed by API route handlers",
    labelNames: ["route", "method", "status"] as const,
    registers: [registry],
  });

  const httpRequestDurationSeconds = new Histogram({
    name: "it_tracker_http_request_duration_seconds",
    help: "HTTP request duration in seconds by route",
    labelNames: ["route", "method", "status"] as const,
    buckets: [0.01, 0.03, 0.05, 0.1, 0.2, 0.35, 0.5, 1, 2, 5, 10, 20],
    registers: [registry],
  });

  const ragUpsertRequestsTotal = new Counter({
    name: "it_tracker_rag_upsert_requests_total",
    help: "RAG upsert requests",
    labelNames: ["status"] as const,
    registers: [registry],
  });

  const ragUpsertChunksTotal = new Counter({
    name: "it_tracker_rag_upsert_chunks_total",
    help: "Total chunks upserted into RAG store",
    labelNames: ["status"] as const,
    registers: [registry],
  });

  const ragUpsertDurationSeconds = new Histogram({
    name: "it_tracker_rag_upsert_duration_seconds",
    help: "RAG upsert duration in seconds",
    labelNames: ["status"] as const,
    buckets: [0.01, 0.03, 0.05, 0.1, 0.2, 0.35, 0.5, 1, 2, 5, 10, 20],
    registers: [registry],
  });

  const ragSearchRequestsTotal = new Counter({
    name: "it_tracker_rag_search_requests_total",
    help: "RAG search requests",
    labelNames: ["status"] as const,
    registers: [registry],
  });

  const ragSearchResultsTotal = new Counter({
    name: "it_tracker_rag_search_results_total",
    help: "Total results returned by RAG searches (sum of per-request result counts)",
    labelNames: ["status"] as const,
    registers: [registry],
  });

  const ragSearchDurationSeconds = new Histogram({
    name: "it_tracker_rag_search_duration_seconds",
    help: "RAG search duration in seconds",
    labelNames: ["status"] as const,
    buckets: [0.005, 0.01, 0.03, 0.05, 0.1, 0.2, 0.35, 0.5, 1, 2, 5, 10],
    registers: [registry],
  });

  const similarTicketsRequestsTotal = new Counter({
    name: "it_tracker_similar_tickets_requests_total",
    help: "Duplicate/similar ticket detection requests",
    labelNames: ["status"] as const,
    registers: [registry],
  });

  const similarTicketsDurationSeconds = new Histogram({
    name: "it_tracker_similar_tickets_duration_seconds",
    help: "Duplicate/similar ticket detection duration in seconds",
    labelNames: ["status"] as const,
    buckets: [0.005, 0.01, 0.03, 0.05, 0.1, 0.2, 0.35, 0.5, 1, 2, 5, 10],
    registers: [registry],
  });

  const aiSuggestRequestsTotal = new Counter({
    name: "it_tracker_ai_suggest_requests_total",
    help: "AI suggestion requests",
    labelNames: ["status"] as const,
    registers: [registry],
  });

  const aiSuggestEvidenceItemsTotal = new Counter({
    name: "it_tracker_ai_suggest_evidence_items_total",
    help: "Evidence items used by AI suggest (sum over requests)",
    labelNames: ["status"] as const,
    registers: [registry],
  });

  const aiSuggestDurationSeconds = new Histogram({
    name: "it_tracker_ai_suggest_duration_seconds",
    help: "AI suggest end-to-end duration in seconds",
    labelNames: ["status"] as const,
    buckets: [0.05, 0.1, 0.2, 0.35, 0.5, 1, 2, 5, 10, 20, 30],
    registers: [registry],
  });

  const aiSopDraftRequestsTotal = new Counter({
    name: "it_tracker_ai_sop_draft_requests_total",
    help: "AI SOP draft requests",
    labelNames: ["status"] as const,
    registers: [registry],
  });

  const aiSopDraftEvidenceItemsTotal = new Counter({
    name: "it_tracker_ai_sop_draft_evidence_items_total",
    help: "Evidence items used by AI SOP draft (sum over requests)",
    labelNames: ["status"] as const,
    registers: [registry],
  });

  const aiSopDraftDurationSeconds = new Histogram({
    name: "it_tracker_ai_sop_draft_duration_seconds",
    help: "AI SOP draft end-to-end duration in seconds",
    labelNames: ["status"] as const,
    buckets: [0.05, 0.1, 0.2, 0.35, 0.5, 1, 2, 5, 10, 20, 30],
    registers: [registry],
  });

  const llmTokensTotal = new Counter({
    name: "it_tracker_llm_tokens_total",
    help: "Total LLM tokens consumed",
    labelNames: ["model", "type"] as const, // prompt or completion
    registers: [registry],
  });

  const llmLatencySeconds = new Histogram({
    name: "it_tracker_llm_latency_seconds",
    help: "LLM inference latency in seconds",
    labelNames: ["model", "status"] as const,
    buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60],
    registers: [registry],
  });

  return {
    registry,
    httpRequestsTotal,
    httpRequestDurationSeconds,
    ragUpsertRequestsTotal,
    ragUpsertChunksTotal,
    ragUpsertDurationSeconds,
    ragSearchRequestsTotal,
    ragSearchResultsTotal,
    ragSearchDurationSeconds,
    similarTicketsRequestsTotal,
    similarTicketsDurationSeconds,
    aiSuggestRequestsTotal,
    aiSuggestEvidenceItemsTotal,
    aiSuggestDurationSeconds,
    aiSopDraftRequestsTotal,
    aiSopDraftEvidenceItemsTotal,
    aiSopDraftDurationSeconds,
    llmTokensTotal,
    llmLatencySeconds,
  };
}

function getGlobalMetrics(): MetricsBundle {
  const g = globalThis as unknown as { __itTrackerMetrics?: MetricsBundle };
  if (!g.__itTrackerMetrics) g.__itTrackerMetrics = createMetrics();
  return g.__itTrackerMetrics;
}

export function metrics() {
  return getGlobalMetrics();
}

export function startTimer(): TimerStop {
  const start = process.hrtime.bigint();
  return () => {
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e9;
  };
}

export function observeHttp(params: {
  route: string;
  method: string;
  status: number;
  durationSeconds: number;
}) {
  const m = metrics();
  const labels = {
    route: params.route,
    method: params.method.toUpperCase(),
    status: String(params.status),
  };

  m.httpRequestsTotal.inc(labels, 1);
  m.httpRequestDurationSeconds.observe(labels, params.durationSeconds);
}
