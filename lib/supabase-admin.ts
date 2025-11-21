import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using service role for privileged operations (e.g., purchases)
// Requires env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);