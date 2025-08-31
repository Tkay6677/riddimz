import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Create a singleton instance
const supabase = createClientComponentClient();

export { supabase };