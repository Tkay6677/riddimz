export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      songs: {
        Row: {
          id: string
          title: string
          artist: string
          user_id: string
          audio_url: string
          cover_url: string | null
          lyrics_url: string | null
          duration: number
          genre: string | null
          is_nft: boolean
          play_count: number
          likes_count: number
          trending_score: number
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          artist: string
          user_id: string
          audio_url: string
          cover_url?: string | null
          lyrics_url?: string | null
          duration: number
          genre?: string | null
          is_nft?: boolean
          play_count?: number
          likes_count?: number
          trending_score?: number
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          artist?: string
          user_id?: string
          audio_url?: string
          cover_url?: string | null
          lyrics_url?: string | null
          duration?: number
          genre?: string | null
          is_nft?: boolean
          play_count?: number
          likes_count?: number
          trending_score?: number
          created_at?: string
        }
      }
      karaoke_rooms: {
        Row: {
          id: string
          name: string
          host_id: string
          description: string | null
          cover_image: string | null
          song_url: string | null
          lyrics_url: string | null
          is_live: boolean
          is_nft_only: boolean
          category: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          host_id: string
          description?: string | null
          cover_image?: string | null
          song_url?: string | null
          lyrics_url?: string | null
          is_live?: boolean
          is_nft_only?: boolean
          category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          host_id?: string
          description?: string | null
          cover_image?: string | null
          song_url?: string | null
          lyrics_url?: string | null
          is_live?: boolean
          is_nft_only?: boolean
          category?: string | null
          created_at?: string
        }
      }
      room_participants: {
        Row: {
          room_id: string
          user_id: string
          joined_at: string
          role: string
        }
        Insert: {
          room_id: string
          user_id: string
          joined_at?: string
          role?: string
        }
        Update: {
          room_id?: string
          user_id?: string
          joined_at?: string
          role?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 