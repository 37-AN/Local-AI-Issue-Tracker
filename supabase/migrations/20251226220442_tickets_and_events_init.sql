BEGIN;

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  resolution_notes text NOT NULL DEFAULT '',
  type text NOT NULL,
  status text NOT NULL,
  priority text NOT NULL,
  service text,
  site text,
  topics text[] NOT NULL DEFAULT '{}'::text[],
  created_by uuid,
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  CONSTRAINT tickets_type_check CHECK (type IN ('Incident','Service Request','Problem','Change')),
  CONSTRAINT tickets_status_check CHECK (status IN ('Open','In Progress','Resolved','Closed')),
  CONSTRAINT tickets_priority_check CHECK (priority IN ('P1','P2','P3','P4'))
);

CREATE INDEX IF NOT EXISTS tickets_status_idx ON public.tickets(status);
CREATE INDEX IF NOT EXISTS tickets_updated_at_idx ON public.tickets(updated_at DESC);
CREATE INDEX IF NOT EXISTS tickets_topics_gin_idx ON public.tickets USING gin(topics);
CREATE UNIQUE INDEX IF NOT EXISTS tickets_external_id_unique ON public.tickets(external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  actor_id uuid,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_events_type_check CHECK (event_type IN ('created','updated','status_changed','commented','assigned'))
);

CREATE INDEX IF NOT EXISTS ticket_events_ticket_id_created_at_idx
  ON public.ticket_events(ticket_id, created_at DESC);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_set_updated_at ON public.tickets;
CREATE TRIGGER tickets_set_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMIT;