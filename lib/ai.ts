import { ragSearch } from "@/lib/rag";

type OllamaChatResponse = {
  message?: { content?: string };
};

export type EvidenceItem = {
  ref: string; // e.g. "E1"
  source_type: string;
  source_id: string;
  title: string;
  score: number;
  content: string;
};

export type AiSuggestInput = {
  title: string;
  description: string;
  topics?: string[];
};

export type AiSuggestion = {
  summary: string;
  confidence_overall: number; // 0..1
  root_causes: Array<{
    cause: string;
    confidence: number; // 0..1
    evidence_refs: string[]; // ["E1","E2"]
  }>;
  recommended_steps: Array<{
    step: string;
    rationale: string;
    evidence_refs: string[];
  }>;
  validation_steps: string[];
  rollback_procedures: string[];
  questions: string[];
};

export type SopDraftInput = {
  ticketTitle: string;
  ticketDescription: string;
  resolutionNotes: string;
  validationNotes?: string;
  rollbackNotes?: string;
  topics?: string[];
};

export type SopDraft = {
  problem_description: string;
  symptoms: string[];
  root_cause: string;
  resolution_steps: string[];
  validation_steps: string[];
  rollback_procedures: string[];
  references: string[]; // evidence refs
};

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "phi3:mini";

function buildEvidenceBlock(evidence: EvidenceItem[]) {
  return evidence
    .map((e) => {
      const header = `${e.ref} [${e.source_type}:${e.source_id}] ${e.title} (score ${e.score.toFixed(
        3
      )})`;
      return `${header}\n${e.content}`;
    })
    .join("\n\n---\n\n");
}

async function ollamaChatJson(args: {
  system: string;
  user: string;
  temperature?: number;
  numPredict?: number;
}): Promise<unknown> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
        options: {
          temperature: args.temperature ?? 0.2,
          num_predict: args.numPredict ?? 700,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Ollama error (${res.status}): ${text || res.statusText}`
      );
    }

    const data = (await res.json()) as OllamaChatResponse;
    const content = data.message?.content ?? "";
    if (!content.trim()) throw new Error("Ollama returned empty content");

    try {
      return JSON.parse(content) as unknown;
    } catch {
      // If the model didn't comply with JSON formatting, return raw string.
      return { raw: content };
    }
  } finally {
    clearTimeout(t);
  }
}

export async function retrieveEvidence(params: {
  query: string;
  limit?: number;
}): Promise<EvidenceItem[]> {
  const results = await ragSearch({ query: params.query, limit: params.limit ?? 6 });

  return results.map((r, idx) => ({
    ref: `E${idx + 1}`,
    source_type: r.source_type,
    source_id: r.source_id,
    title: r.title,
    score: r.score,
    content: r.content,
  }));
}

export async function aiSuggest(input: AiSuggestInput): Promise<{
  evidence: EvidenceItem[];
  suggestion: AiSuggestion | { raw: string };
  model: { host: string; name: string };
}> {
  const query = [
    input.title.trim(),
    input.description.trim(),
    (input.topics ?? []).length ? `Topics: ${(input.topics ?? []).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const evidence = await retrieveEvidence({ query, limit: 6 });

  if (evidence.length === 0) {
    return {
      evidence: [],
      suggestion: {
        summary:
          "Insufficient internal evidence available in RAG memory to provide grounded recommendations.",
        confidence_overall: 0,
        root_causes: [],
        recommended_steps: [],
        validation_steps: [],
        rollback_procedures: [],
        questions: [
          "Add relevant prior resolutions/SOPs to RAG memory, or provide more context (exact errors, impacted hosts, time window, recent changes).",
        ],
      },
      model: { host: OLLAMA_HOST, name: OLLAMA_MODEL },
    };
  }

  const system = [
    "You are an expert L2/L3 support engineer specializing in industrial software (MES, ERP, PLC) and enterprise IT systems.",
    "Your objective: Provide highly technical, concise, and grounded resolution guidance.",
    "BEYOND ALL: You MUST be strictly grounded in the provided EVIDENCE (RAG). Do not use outside knowledge or hallucinate commands.",
    "If evidence is insufficient, clearly state that and ask specific technical questions.",
    "Return ONLY valid JSON matching the requested schema. No markdown, no pre-amble.",
    "All confidence values must be accurate numbers in [0,1] reflecting evidence strength.",
  ].join(" ");

  const user = [
    "TASK: Analyze the issue and propose likely root causes and step-by-step resolution guidance.",
    "",
    "ISSUE:",
    `Title: ${input.title}`,
    `Description: ${input.description || "(none)"}`,
    (input.topics ?? []).length ? `Topics: ${(input.topics ?? []).join(", ")}` : "",
    "",
    "EVIDENCE:",
    buildEvidenceBlock(evidence),
    "",
    "OUTPUT JSON SCHEMA:",
    `{
  "summary": string,
  "confidence_overall": number,
  "root_causes": [{"cause": string, "confidence": number, "evidence_refs": string[]}],
  "recommended_steps": [{"step": string, "rationale": string, "evidence_refs": string[]}],
  "validation_steps": string[],
  "rollback_procedures": string[],
  "questions": string[]
}`,
    "",
    "RULES:",
    "- Every root cause and every step MUST include at least one evidence_refs entry from the provided refs (E1..En).",
    "- If you cannot support something with evidence, do not include it; instead add it as a question.",
  ]
    .filter(Boolean)
    .join("\n");

  const suggestion = (await ollamaChatJson({
    system,
    user,
    temperature: 0.15,
    numPredict: 700,
  })) as AiSuggestion | { raw: string };

  return {
    evidence,
    suggestion,
    model: { host: OLLAMA_HOST, name: OLLAMA_MODEL },
  };
}

export async function aiSopDraft(input: SopDraftInput): Promise<{
  evidence: EvidenceItem[];
  sop: SopDraft | { raw: string };
  model: { host: string; name: string };
}> {
  const query = [
    input.ticketTitle.trim(),
    input.ticketDescription.trim(),
    input.resolutionNotes.trim(),
    (input.topics ?? []).length ? `Topics: ${(input.topics ?? []).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const evidence = await retrieveEvidence({ query, limit: 8 });

  if (evidence.length === 0) {
    return {
      evidence: [],
      sop: {
        problem_description:
          "Insufficient internal evidence available in RAG memory to generate a grounded SOP draft.",
        symptoms: [],
        root_cause: "",
        resolution_steps: [],
        validation_steps: [],
        rollback_procedures: [],
        references: [],
      },
      model: { host: OLLAMA_HOST, name: OLLAMA_MODEL },
    };
  }

  const system = [
    "You are a technical documentation specialist and senior operations engineer.",
    "TASK: Synthesize the provided resolution notes and RAG evidence into a professional Standard Operating Procedure (SOP).",
    "RULES: Use strictly imperative, clear technical language. Ground all steps in the evidence and resolution notes provided.",
    "Do not invent commands or configuration paths. If missing, be conservative.",
    "Return ONLY valid JSON. No markdown summaries or chat chatter.",
  ].join(" ");

  const user = [
    "TASK: Generate a Standard Operating Procedure (SOP) draft for the resolved issue.",
    "",
    "TICKET:",
    `Title: ${input.ticketTitle}`,
    `Description: ${input.ticketDescription || "(none)"}`,
    (input.topics ?? []).length ? `Topics: ${(input.topics ?? []).join(", ")}` : "",
    "",
    "RESOLUTION NOTES (authoritative):",
    input.resolutionNotes,
    "",
    "OPTIONAL NOTES:",
    `Validation: ${input.validationNotes ?? "(none)"}`,
    `Rollback: ${input.rollbackNotes ?? "(none)"}`,
    "",
    "EVIDENCE:",
    buildEvidenceBlock(evidence),
    "",
    "OUTPUT JSON SCHEMA:",
    `{
  "problem_description": string,
  "symptoms": string[],
  "root_cause": string,
  "resolution_steps": string[],
  "validation_steps": string[],
  "rollback_procedures": string[],
  "references": string[]
}`,
    "",
    "RULES:",
    "- Use clear imperative steps.",
    "- Include validation and rollback procedures if supported; otherwise keep them minimal and conservative.",
    "- references must be evidence refs used (E1..En).",
  ].join("\n");

  const sop = (await ollamaChatJson({
    system,
    user,
    temperature: 0.1,
    numPredict: 900,
  })) as SopDraft | { raw: string };

  return { evidence, sop, model: { host: OLLAMA_HOST, name: OLLAMA_MODEL } };
}
