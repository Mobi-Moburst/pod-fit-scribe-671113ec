export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      aeo_audit_cache: {
        Row: {
          citations: Json
          client_present: boolean
          company_id: string | null
          competitors_present: string[]
          created_at: string
          engine: string
          id: string
          org_id: string
          prompt: string
          response_text: string | null
          stage: string | null
          topic: string | null
        }
        Insert: {
          citations?: Json
          client_present?: boolean
          company_id?: string | null
          competitors_present?: string[]
          created_at?: string
          engine?: string
          id?: string
          org_id: string
          prompt: string
          response_text?: string | null
          stage?: string | null
          topic?: string | null
        }
        Update: {
          citations?: Json
          client_present?: boolean
          company_id?: string | null
          competitors_present?: string[]
          created_at?: string
          engine?: string
          id?: string
          org_id?: string
          prompt?: string
          response_text?: string | null
          stage?: string | null
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aeo_audit_cache_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      airtable_connections: {
        Row: {
          base_id: string
          company_id: string | null
          created_at: string
          field_mapping: Json
          id: string
          last_synced_at: string | null
          name: string
          org_id: string
          personal_access_token: string | null
          speaker_column_name: string | null
          speaker_id: string | null
          table_id: string
          updated_at: string
        }
        Insert: {
          base_id: string
          company_id?: string | null
          created_at?: string
          field_mapping?: Json
          id?: string
          last_synced_at?: string | null
          name: string
          org_id: string
          personal_access_token?: string | null
          speaker_column_name?: string | null
          speaker_id?: string | null
          table_id: string
          updated_at?: string
        }
        Update: {
          base_id?: string
          company_id?: string | null
          created_at?: string
          field_mapping?: Json
          id?: string
          last_synced_at?: string | null
          name?: string
          org_id?: string
          personal_access_token?: string | null
          speaker_column_name?: string | null
          speaker_id?: string | null
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "airtable_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "airtable_connections_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_sessions: {
        Row: {
          client_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string | null
          org_id: string
          speaker_id: string | null
          success_count: number | null
          total_count: number | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string | null
          org_id: string
          speaker_id?: string | null
          success_count?: number | null
          total_count?: number | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string | null
          org_id?: string
          speaker_id?: string | null
          success_count?: number | null
          total_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_sessions_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      call_notes: {
        Row: {
          action_items: Json | null
          company_id: string | null
          created_at: string
          duration_seconds: number | null
          fathom_meeting_id: string | null
          id: string
          meeting_date: string | null
          meeting_title: string | null
          org_id: string
          participants: Json | null
          source: string
          speaker_id: string | null
          summary: string | null
          transcript: string | null
        }
        Insert: {
          action_items?: Json | null
          company_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          fathom_meeting_id?: string | null
          id?: string
          meeting_date?: string | null
          meeting_title?: string | null
          org_id: string
          participants?: Json | null
          source?: string
          speaker_id?: string | null
          summary?: string | null
          transcript?: string | null
        }
        Update: {
          action_items?: Json | null
          company_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          fathom_meeting_id?: string | null
          id?: string
          meeting_date?: string | null
          meeting_title?: string | null
          org_id?: string
          participants?: Json | null
          source?: string
          speaker_id?: string | null
          summary?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_notes_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          airtable_embed_url: string | null
          avoid: string[] | null
          campaign_manager: string | null
          campaign_strategy: string | null
          company: string
          company_url: string | null
          competitors: Json | null
          created_at: string | null
          gender: string | null
          guest_identity_tags: string[] | null
          id: string
          logo_url: string | null
          media_kit_url: string | null
          name: string
          notes: string | null
          org_id: string
          pitch_template: string | null
          product_type: string | null
          professional_credentials: string[] | null
          tags: string[] | null
          talking_points: string[] | null
          target_audiences: string[] | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          airtable_embed_url?: string | null
          avoid?: string[] | null
          campaign_manager?: string | null
          campaign_strategy?: string | null
          company: string
          company_url?: string | null
          competitors?: Json | null
          created_at?: string | null
          gender?: string | null
          guest_identity_tags?: string[] | null
          id?: string
          logo_url?: string | null
          media_kit_url?: string | null
          name: string
          notes?: string | null
          org_id: string
          pitch_template?: string | null
          product_type?: string | null
          professional_credentials?: string[] | null
          tags?: string[] | null
          talking_points?: string[] | null
          target_audiences?: string[] | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          airtable_embed_url?: string | null
          avoid?: string[] | null
          campaign_manager?: string | null
          campaign_strategy?: string | null
          company?: string
          company_url?: string | null
          competitors?: Json | null
          created_at?: string | null
          gender?: string | null
          guest_identity_tags?: string[] | null
          id?: string
          logo_url?: string | null
          media_kit_url?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          pitch_template?: string | null
          product_type?: string | null
          professional_credentials?: string[] | null
          tags?: string[] | null
          talking_points?: string[] | null
          target_audiences?: string[] | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          airtable_embed_url: string | null
          archived_at: string | null
          brand_colors: Json | null
          campaign_manager: string | null
          company_url: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          org_id: string
          product_type: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          airtable_embed_url?: string | null
          archived_at?: string | null
          brand_colors?: Json | null
          campaign_manager?: string | null
          company_url?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          org_id: string
          product_type?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          airtable_embed_url?: string | null
          archived_at?: string | null
          brand_colors?: Json | null
          campaign_manager?: string | null
          company_url?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          product_type?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      evaluations: {
        Row: {
          batch_session_id: string | null
          citations: Json | null
          client_id: string
          confidence: number | null
          created_at: string | null
          episode_description: string | null
          episode_title: string | null
          id: string
          ineligibility_reason: string | null
          is_eligible: boolean | null
          org_id: string
          overall_score: number | null
          rubric_json: Json | null
          show_description: string | null
          show_title: string | null
          speaker_id: string | null
          url: string
        }
        Insert: {
          batch_session_id?: string | null
          citations?: Json | null
          client_id: string
          confidence?: number | null
          created_at?: string | null
          episode_description?: string | null
          episode_title?: string | null
          id?: string
          ineligibility_reason?: string | null
          is_eligible?: boolean | null
          org_id: string
          overall_score?: number | null
          rubric_json?: Json | null
          show_description?: string | null
          show_title?: string | null
          speaker_id?: string | null
          url: string
        }
        Update: {
          batch_session_id?: string | null
          citations?: Json | null
          client_id?: string
          confidence?: number | null
          created_at?: string | null
          episode_description?: string | null
          episode_title?: string | null
          id?: string
          ineligibility_reason?: string | null
          is_eligible?: boolean | null
          org_id?: string
          overall_score?: number | null
          rubric_json?: Json | null
          show_description?: string | null
          show_title?: string | null
          speaker_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_metadata_cache: {
        Row: {
          apple_podcast_url: string
          categories: string | null
          created_at: string
          description: string | null
          fetched_at: string
          id: string
          listeners_per_episode: number | null
          monthly_listens: number | null
          org_id: string
          podcast_name: string | null
          social_reach: number | null
        }
        Insert: {
          apple_podcast_url: string
          categories?: string | null
          created_at?: string
          description?: string | null
          fetched_at?: string
          id?: string
          listeners_per_episode?: number | null
          monthly_listens?: number | null
          org_id: string
          podcast_name?: string | null
          social_reach?: number | null
        }
        Update: {
          apple_podcast_url?: string
          categories?: string | null
          created_at?: string
          description?: string | null
          fetched_at?: string
          id?: string
          listeners_per_episode?: number | null
          monthly_listens?: number | null
          org_id?: string
          podcast_name?: string | null
          social_reach?: number | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          batch_session_id: string | null
          company_id: string | null
          created_at: string | null
          date_range_end: string
          date_range_start: string
          generated_at: string | null
          id: string
          is_published: boolean | null
          org_id: string
          public_slug: string | null
          published_at: string | null
          quarter: string | null
          report_data: Json
          report_name: string
          report_password_hash: string | null
          speaker_id: string | null
        }
        Insert: {
          batch_session_id?: string | null
          company_id?: string | null
          created_at?: string | null
          date_range_end: string
          date_range_start: string
          generated_at?: string | null
          id?: string
          is_published?: boolean | null
          org_id: string
          public_slug?: string | null
          published_at?: string | null
          quarter?: string | null
          report_data: Json
          report_name: string
          report_password_hash?: string | null
          speaker_id?: string | null
        }
        Update: {
          batch_session_id?: string | null
          company_id?: string | null
          created_at?: string | null
          date_range_end?: string
          date_range_start?: string
          generated_at?: string | null
          id?: string
          is_published?: boolean | null
          org_id?: string
          public_slug?: string | null
          published_at?: string | null
          quarter?: string | null
          report_data?: Json
          report_name?: string
          report_password_hash?: string | null
          speaker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_batch_session_id_fkey"
            columns: ["batch_session_id"]
            isOneToOne: false
            referencedRelation: "batch_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      speakers: {
        Row: {
          airtable_embed_url: string | null
          archived_at: string | null
          avoid: string[] | null
          campaign_strategy: string | null
          company_id: string
          competitors: Json | null
          created_at: string | null
          gender: string | null
          guest_identity_tags: string[] | null
          headshot_url: string | null
          id: string
          media_kit_url: string | null
          name: string
          org_id: string
          pitch_template: string | null
          professional_credentials: string[] | null
          quarterly_notes: Json | null
          talking_points: string[] | null
          target_audiences: string[] | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          airtable_embed_url?: string | null
          archived_at?: string | null
          avoid?: string[] | null
          campaign_strategy?: string | null
          company_id: string
          competitors?: Json | null
          created_at?: string | null
          gender?: string | null
          guest_identity_tags?: string[] | null
          headshot_url?: string | null
          id?: string
          media_kit_url?: string | null
          name: string
          org_id: string
          pitch_template?: string | null
          professional_credentials?: string[] | null
          quarterly_notes?: Json | null
          talking_points?: string[] | null
          target_audiences?: string[] | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          airtable_embed_url?: string | null
          archived_at?: string | null
          avoid?: string[] | null
          campaign_strategy?: string | null
          company_id?: string
          competitors?: Json | null
          created_at?: string | null
          gender?: string | null
          guest_identity_tags?: string[] | null
          headshot_url?: string | null
          id?: string
          media_kit_url?: string | null
          name?: string
          org_id?: string
          pitch_template?: string | null
          professional_credentials?: string[] | null
          quarterly_notes?: Json | null
          talking_points?: string[] | null
          target_audiences?: string[] | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "speakers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_team_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "viewer"],
    },
  },
} as const
