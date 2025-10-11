'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useMemo } from 'react';

interface UserProfile {
  id: string;
  user_id: string;
  display_name?: string;
  bio?: string;
  location?: string;
  website?: string;
  social_links?: Record<string, string>;
  profile_banner_url?: string;
  profile_theme?: string;
  privacy_settings?: {
    profile_visibility: 'public' | 'private';
    show_activity: boolean;
    show_playlists: boolean;
    allow_messages: boolean;
  };
  notification_preferences?: {
    email_notifications: boolean;
    push_notifications: boolean;
    karaoke_invites: boolean;
    new_followers: boolean;
    song_recommendations: boolean;
    // Added optional fields used by Settings page
    performance_reminders?: boolean;
    weekly_digest?: boolean;
  };
  // Added appearance preferences used by Settings page
  appearance_preferences?: {
    font_size?: number;
    sound_effects?: boolean;
    animations?: boolean;
    compact_mode?: boolean;
  };
  created_at: string;
  updated_at: string;
}

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setProfile(null);
        return;
      }

      // First try to get existing profile
      let { data, error: profileError } = await supabase
        .from('user_profile')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // If no profile exists, create one
      if (profileError && profileError.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase
          .from('user_profile')
          .insert({
            user_id: user.id,
            display_name: user.user_metadata?.username || user.email?.split('@')[0] || 'User',
          })
          .select()
          .single();

        if (createError) throw createError;
        data = newProfile;
      } else if (profileError) {
        throw profileError;
      }

      setProfile(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data, error: updateError } = await supabase
        .from('user_profile')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setProfile(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Not authenticated');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      await updateProfile({ profile_banner_url: publicUrl });

      return publicUrl;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return useMemo(() => ({
    profile,
    loading,
    error,
    updateProfile,
    uploadAvatar,
    refreshProfile: fetchProfile
  }), [profile, loading, error]);
}