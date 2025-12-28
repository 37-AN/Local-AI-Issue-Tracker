import { createClient as create } from '@supabase/supabase-js'
import { type Database } from '@/database.types'

export async function createClient() {
  return create<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
