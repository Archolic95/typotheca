import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export function getSupabaseService() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}
