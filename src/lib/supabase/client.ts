import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

let client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseBrowser() {
  if (client) return client;
  client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
