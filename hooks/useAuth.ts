'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { User } from '@supabase/supabase-js';

import { useMemo } from 'react';

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseClient();

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);



  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signInWithWallet = async () => {
    try {
      // Check if Phantom wallet is available
      if (typeof window !== 'undefined' && window.solana && window.solana.isPhantom) {
        // Connect to Phantom wallet first
        await window.solana.connect();
        
        // Use Supabase's built-in Web3 authentication with proper URI
        const { data, error } = await supabase.auth.signInWithWeb3({
          chain: 'solana',
          statement: `I accept the Terms of Service at ${window.location.origin} and agree to sign in to Riddimz with my Solana wallet.`,
        });
        
        if (error) throw error;
        return { data, error: null };
      } else {
        throw new Error('Phantom wallet not found. Please install Phantom wallet extension.');
      }
    } catch (error) {
      return { data: null, error };
    }
  };


  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Show success message
      console.log('Successfully signed out');
      
      // Redirect to login page
      router.push('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return useMemo(() => ({
    user,
    loading,
    signInWithGoogle,
    signInWithWallet,
    signOut
  }), [user, loading]);
}