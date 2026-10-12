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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_secrets: {
        Row: {
          code: string | null
          code_hash: string | null
          id: number
          is_default: boolean
        }
        Insert: {
          code?: string | null
          code_hash?: string | null
          id?: number
          is_default?: boolean
        }
        Update: {
          code?: string | null
          code_hash?: string | null
          id?: number
          is_default?: boolean
        }
        Relationships: []
      }
      event_runtimes: {
        Row: {
          current_team_id: string | null
          demo_mode: boolean
          event_id: string
          id: number
          phase: string
          scores_revealed: boolean
          scoring_open: boolean
          timer_started_at: string | null
          updated_at: string
          version: number
          voting_open: boolean
          weights: Json
        }
        Insert: {
          current_team_id?: string | null
          demo_mode?: boolean
          event_id: string
          id?: number
          phase?: string
          scores_revealed?: boolean
          scoring_open?: boolean
          timer_started_at?: string | null
          updated_at?: string
          version?: number
          voting_open?: boolean
          weights?: Json
        }
        Update: {
          current_team_id?: string | null
          demo_mode?: boolean
          event_id?: string
          id?: number
          phase?: string
          scores_revealed?: boolean
          scoring_open?: boolean
          timer_started_at?: string | null
          updated_at?: string
          version?: number
          voting_open?: boolean
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "event_runtimes_current_team_id_fkey"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_runtimes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_state: {
        Row: {
          current_team_id: string | null
          demo_mode: boolean
          id: number
          phase: string
          scores_revealed: boolean
          scoring_open: boolean
          timer_started_at: string | null
          updated_at: string
          version: number
          voting_open: boolean
          weights: Json
        }
        Insert: {
          current_team_id?: string | null
          demo_mode?: boolean
          id?: number
          phase?: string
          scores_revealed?: boolean
          scoring_open?: boolean
          timer_started_at?: string | null
          updated_at?: string
          version?: number
          voting_open?: boolean
          weights?: Json
        }
        Update: {
          current_team_id?: string | null
          demo_mode?: boolean
          id?: number
          phase?: string
          scores_revealed?: boolean
          scoring_open?: boolean
          timer_started_at?: string | null
          updated_at?: string
          version?: number
          voting_open?: boolean
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "event_state_current_team_id_fkey"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          city: string
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          name: string
          name_zh: string
          organizer: string
          partner: string
          starts_at: string
          timezone: string
          venue: string
        }
        Insert: {
          city?: string
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          name: string
          name_zh?: string
          organizer?: string
          partner?: string
          starts_at: string
          timezone?: string
          venue: string
        }
        Update: {
          city?: string
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_zh?: string
          organizer?: string
          partner?: string
          starts_at?: string
          timezone?: string
          venue?: string
        }
        Relationships: []
      }
      judges: {
        Row: {
          code: string | null
          code_hash: string | null
          event_id: string | null
          id: string
          is_default: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code?: string | null
          code_hash?: string | null
          event_id?: string | null
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string | null
          code_hash?: string | null
          event_id?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "judges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          clarity: number
          data: number
          event_id: string | null
          execution: number
          id: string
          impact: number
          judge_id: string
          locked: boolean
          problem: number
          team_id: string
          updated_at: string
        }
        Insert: {
          clarity: number
          data: number
          event_id?: string | null
          execution: number
          id?: string
          impact: number
          judge_id: string
          locked?: boolean
          problem: number
          team_id: string
          updated_at?: string
        }
        Update: {
          clarity?: number
          data?: number
          event_id?: string | null
          execution?: number
          id?: string
          impact?: number
          judge_id?: string
          locked?: boolean
          problem?: number
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "judges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          ai_summary: string
          ai_summary_at: string | null
          created_at: string
          description: string
          email: string
          event_id: string | null
          github_repo: string
          id: string
          lovable_commit_share: number | null
          lovable_project_id: string
          lovable_url: string
          name: string
          notes: string
          phase_breakdown: Json
          project_name: string
          review_status: string
          scan_confidence: string
          scan_note: string
          scan_signals: Json
          scan_verdict: string
          scanned_at: string | null
          track_id: number
        }
        Insert: {
          ai_summary?: string
          ai_summary_at?: string | null
          created_at?: string
          description?: string
          email: string
          event_id?: string | null
          github_repo?: string
          id?: string
          lovable_commit_share?: number | null
          lovable_project_id?: string
          lovable_url: string
          name: string
          notes?: string
          phase_breakdown?: Json
          project_name: string
          review_status?: string
          scan_confidence?: string
          scan_note?: string
          scan_signals?: Json
          scan_verdict?: string
          scanned_at?: string | null
          track_id: number
        }
        Update: {
          ai_summary?: string
          ai_summary_at?: string | null
          created_at?: string
          description?: string
          email?: string
          event_id?: string | null
          github_repo?: string
          id?: string
          lovable_commit_share?: number | null
          lovable_project_id?: string
          lovable_url?: string
          name?: string
          notes?: string
          phase_breakdown?: Json
          project_name?: string
          review_status?: string
          scan_confidence?: string
          scan_note?: string
          scan_signals?: Json
          scan_verdict?: string
          scanned_at?: string | null
          track_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          built_with_lovable: boolean
          created_at: string
          deck_url: string
          description: string
          event_id: string | null
          id: string
          is_demo: boolean
          members: string
          name: string
          project_name: string
          sort_order: number
          table_number: string
          track_id: number | null
          voter_group: string
        }
        Insert: {
          built_with_lovable?: boolean
          created_at?: string
          deck_url?: string
          description?: string
          event_id?: string | null
          id?: string
          is_demo?: boolean
          members?: string
          name: string
          project_name?: string
          sort_order?: number
          table_number?: string
          track_id?: number | null
          voter_group?: string
        }
        Update: {
          built_with_lovable?: boolean
          created_at?: string
          deck_url?: string
          description?: string
          event_id?: string | null
          id?: string
          is_demo?: boolean
          members?: string
          name?: string
          project_name?: string
          sort_order?: number
          table_number?: string
          track_id?: number | null
          voter_group?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          data_sources: string
          event_id: string | null
          id: number
          name_en: string
          name_zh: string
          sources: Json
        }
        Insert: {
          data_sources?: string
          event_id?: string | null
          id: number
          name_en: string
          name_zh: string
          sources?: Json
        }
        Update: {
          data_sources?: string
          event_id?: string | null
          id?: number
          name_en?: string
          name_zh?: string
          sources?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tracks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      voters: {
        Row: {
          code: string
          event_id: string | null
          id: string
          is_demo: boolean
          team_id: string | null
        }
        Insert: {
          code: string
          event_id?: string | null
          id?: string
          is_demo?: boolean
          team_id?: string | null
        }
        Update: {
          code?: string
          event_id?: string | null
          id?: string
          is_demo?: boolean
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voters_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          team_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          team_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          team_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "voters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _active_event_id: { Args: never; Returns: string }
      _is_admin: { Args: { p_code: string }; Returns: boolean }
      _judge_id: { Args: { p_code: string }; Returns: string }
      _require_admin: { Args: { p_code: string }; Returns: undefined }
      admin_activate_event: {
        Args: { p_code: string; p_id: string }
        Returns: undefined
      }
      admin_code_status: { Args: { p_code: string }; Returns: Json }
      admin_create_event: {
        Args: { p_code: string; p_patch: Json }
        Returns: string
      }
      admin_delete_submission: {
        Args: { p_code: string; p_id: string }
        Returns: undefined
      }
      admin_delete_team: {
        Args: { p_code: string; p_id: string }
        Returns: undefined
      }
      admin_disable_demo: { Args: { p_code: string }; Returns: undefined }
      admin_generate_voters: {
        Args: { p_code: string; p_count: number; p_team: string }
        Returns: string[]
      }
      admin_list_submissions: { Args: { p_code: string }; Returns: Json }
      admin_list_voters: { Args: { p_code: string }; Returns: Json }
      admin_login: { Args: { p_code: string }; Returns: boolean }
      admin_reopen_score: {
        Args: { p_code: string; p_judge: string; p_team: string }
        Returns: undefined
      }
      admin_reset: {
        Args: { p_code: string; p_what: string }
        Returns: undefined
      }
      admin_save_event: {
        Args: { p_code: string; p_id: string; p_patch: Json }
        Returns: string
      }
      admin_save_scan: {
        Args: { p_code: string; p_id: string; p_patch: Json }
        Returns: undefined
      }
      admin_set_admin_code: {
        Args: { p_code: string; p_new: string }
        Returns: undefined
      }
      admin_set_judge_code: {
        Args: { p_code: string; p_judge: string; p_new: string }
        Returns: undefined
      }
      admin_update_state: {
        Args: { p_code: string; p_patch: Json }
        Returns: undefined
      }
      admin_update_submission: {
        Args: { p_code: string; p_id: string; p_patch: Json }
        Returns: undefined
      }
      admin_update_track: {
        Args: {
          p_code: string
          p_data_sources: string
          p_id: number
          p_sources: Json
        }
        Returns: undefined
      }
      admin_upsert_team: {
        Args: { p_code: string; p_team: Json }
        Returns: string
      }
      cast_vote: {
        Args: { p_code: string; p_team: string }
        Returns: undefined
      }
      get_results: { Args: { p_code?: string }; Returns: Json }
      judge_login: { Args: { p_code: string }; Returns: Json }
      judge_my_scores: {
        Args: { p_code: string }
        Returns: {
          clarity: number
          data: number
          event_id: string | null
          execution: number
          id: string
          impact: number
          judge_id: string
          locked: boolean
          problem: number
          team_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "scores"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      public_event_state: { Args: never; Returns: Json }
      public_events: {
        Args: never
        Returns: {
          city: string
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          name: string
          name_zh: string
          organizer: string
          partner: string
          starts_at: string
          timezone: string
          venue: string
        }[]
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      public_judges: {
        Args: never
        Returns: {
          id: string
          name: string
          sort_order: number
        }[]
      }
      public_teams: {
        Args: never
        Returns: {
          built_with_lovable: boolean
          created_at: string
          deck_url: string
          description: string
          event_id: string | null
          id: string
          is_demo: boolean
          members: string
          name: string
          project_name: string
          sort_order: number
          table_number: string
          track_id: number | null
          voter_group: string
        }[]
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      public_tracks: {
        Args: never
        Returns: {
          data_sources: string
          event_id: string | null
          id: number
          name_en: string
          name_zh: string
          sources: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "tracks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      submit_project: {
        Args: {
          p_email: string
          p_name: string
          p_project: string
          p_track: number
          p_url: string
        }
        Returns: undefined
      }
      submit_score: {
        Args: {
          p_clarity: number
          p_code: string
          p_data: number
          p_execution: number
          p_impact: number
          p_problem: number
          p_team: string
        }
        Returns: undefined
      }
      voter_login: { Args: { p_code: string }; Returns: Json }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
