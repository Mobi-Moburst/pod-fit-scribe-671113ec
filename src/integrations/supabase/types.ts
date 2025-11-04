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
      batch_sessions: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          avoid: string[] | null
          campaign_manager: string | null
          campaign_strategy: string | null
          company: string
          company_url: string | null
          created_at: string | null
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
          updated_at: string | null
        }
        Insert: {
          avoid?: string[] | null
          campaign_manager?: string | null
          campaign_strategy?: string | null
          company: string
          company_url?: string | null
          created_at?: string | null
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
          updated_at?: string | null
        }
        Update: {
          avoid?: string[] | null
          campaign_manager?: string | null
          campaign_strategy?: string | null
          company?: string
          company_url?: string | null
          created_at?: string | null
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
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_team_org_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
