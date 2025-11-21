'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Session, User } from '@supabase/supabase-js';

type SupabaseContext = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

const Context = createContext<SupabaseContext>({
  user: null,
  session: null,
  loading: true,
});

export default function SupabaseProvider({
  children
}: {
  children: React.ReactNode
}) {
  console.log('SupabaseProvider rendered');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // Memoize the Supabase client so it's not recreated on every render
  const supabase = useRef(createClientComponentClient()).current;
  // Track previous user id to detect real changes
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      prevUserIdRef.current = session?.user?.id ?? null;
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      const newUserId = session?.user?.id ?? null;
      // Only update state and refresh router if user id actually changes
      if (prevUserIdRef.current !== newUserId) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        prevUserIdRef.current = newUserId;
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase.auth]);

  return (
    <Context.Provider value={{ user, session, loading }}>
      {children}
    </Context.Provider>
  );
}

export const useSupabase = () => {
  const context = useContext(Context);
  if (context === undefined) {
    throw new Error('useSupabase must be used inside SupabaseProvider');
  }
  return context;
};