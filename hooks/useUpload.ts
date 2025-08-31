'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const uploadFile = async (file: File, bucket: string, path: string): Promise<string> => {
    try {
      setUploading(true);
      setError(null);

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Ensure the file name is URL-safe
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${user.id}/${Date.now()}_${safeFileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (bucket: string, path: string) => {
    try {
      setUploading(true);
      setError(null);

      if (!user) {
        throw new Error('Not authenticated');
      }

      const { error: deleteError } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploading,
    error,
    uploadFile,
    deleteFile
  };
} 