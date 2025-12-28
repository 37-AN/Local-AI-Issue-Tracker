BEGIN;

-- Enable Row Level Security (RLS) on tickets and events
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to perform all actions on their own data
-- This is a permissive policy for a local-first application.
-- For a production multitenant app, you would add more restrictive policies,
-- e.g., WHERE created_by = auth.uid()
DROP POLICY IF EXISTS "Allow authenticated users full access to tickets" ON public.tickets;
CREATE POLICY "Allow authenticated users full access to tickets"
  ON public.tickets
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users full access to ticket_events" ON public.ticket_events;
CREATE POLICY "Allow authenticated users full access to ticket_events"
  ON public.ticket_events
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
