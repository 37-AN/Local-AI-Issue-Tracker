BEGIN;

-- Table for SOPs (Standard Operating Procedures)
CREATE TABLE IF NOT EXISTS public.sops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  problem_description text NOT NULL,
  symptoms text[] NOT NULL DEFAULT '{}'::text[],
  root_cause text NOT NULL,
  resolution_steps text[] NOT NULL DEFAULT '{}'::text[],
  validation_steps text[] NOT NULL DEFAULT '{}'::text[],
  rollback_procedures text[] NOT NULL DEFAULT '{}'::text[],
  references text[] NOT NULL DEFAULT '{}'::text[], -- evidence refs
  tags text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'Draft', -- 'Draft', 'Approved'
  version text NOT NULL DEFAULT '1.0.0',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sops_status_check CHECK (status IN ('Draft', 'Approved'))
);

CREATE INDEX IF NOT EXISTS sops_tags_gin_idx ON public.sops USING gin(tags);
CREATE INDEX IF NOT EXISTS sops_updated_at_idx ON public.sops(updated_at DESC);

-- Table for AI Recommendation Ratings
CREATE TABLE IF NOT EXISTS public.ai_recommendation_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  recommendation_payload jsonb NOT NULL, -- The suggestion JSON
  rating integer NOT NULL, -- 1-5
  feedback text,
  model_info jsonb NOT NULL, -- {host, name}
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_recommendation_ratings_rating_check CHECK (rating >= 1 AND rating <= 5)
);

CREATE INDEX IF NOT EXISTS ai_recommendation_ratings_ticket_idx ON public.ai_recommendation_ratings(ticket_id);

-- Table for tracking external ticket sync status
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL, -- 'github', 'jira', etc.
  status text NOT NULL, -- 'running', 'completed', 'failed'
  items_processed integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS sync_logs_source_idx ON public.sync_logs(source);

-- Trigger for updated_at on sops
DROP TRIGGER IF EXISTS sops_set_updated_at ON public.sops;
CREATE TRIGGER sops_set_updated_at
BEFORE UPDATE ON public.sops
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMIT;
