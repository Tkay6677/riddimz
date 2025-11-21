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
      users: {
        Row: {
          id: string
          email: string | null
          username: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          username: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
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
      marketplace_listings: {
        Row: {
          id: string
          song_id: string
          title: string
          artist: string
          metadata_uri: string | null
          price_sol: number
          supply: number
          minted_addresses: string[]
          seller_wallet_address: string
          seller_user_id: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          song_id: string
          title: string
          artist: string
          metadata_uri?: string | null
          price_sol: number
          supply: number
          minted_addresses?: string[]
          seller_wallet_address: string
          seller_user_id: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          song_id?: string
          title?: string
          artist?: string
          metadata_uri?: string | null
          price_sol?: number
          supply?: number
          minted_addresses?: string[]
          seller_wallet_address?: string
          seller_user_id?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          room_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
      }
      podcast_chat_messages: {
        Row: {
          id: string
          room_id: string
          user_id: string | null
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id?: string | null
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string | null
          content?: string
          created_at?: string
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