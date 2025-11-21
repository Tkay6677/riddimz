import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';

// Create a singleton instance
const supabase = createClientComponentClient<Database>();

export { supabase };