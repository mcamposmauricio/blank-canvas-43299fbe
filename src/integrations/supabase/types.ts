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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      action_plans: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          dimension_name: string | null
          due_date: string | null
          id: string
          responsible: string | null
          status: Database["public"]["Enums"]["action_status"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          dimension_name?: string | null
          due_date?: string | null
          id?: string
          responsible?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          dimension_name?: string | null
          due_date?: string | null
          id?: string
          responsible?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "survey_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_scores: {
        Row: {
          avg_score: number
          campaign_id: string
          dimension_id: string
          id: string
          max_score: number | null
          min_score: number | null
          responses_count: number
          std_dev: number | null
        }
        Insert: {
          avg_score: number
          campaign_id: string
          dimension_id: string
          id?: string
          max_score?: number | null
          min_score?: number | null
          responses_count?: number
          std_dev?: number | null
        }
        Update: {
          avg_score?: number
          campaign_id?: string
          dimension_id?: string
          id?: string
          max_score?: number | null
          min_score?: number | null
          responses_count?: number
          std_dev?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_scores_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "survey_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_scores_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "survey_dimensions"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          accepted_at: string
          campaign_id: string
          consent_text: string
          consent_version: number
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          campaign_id: string
          consent_text: string
          consent_version?: number
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          campaign_id?: string
          consent_text?: string
          consent_version?: number
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "survey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          org_unit_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_unit_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_unit_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          job_role_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          job_role_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          job_role_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_scores: {
        Row: {
          avg_score: number
          campaign_id: string
          dimension_id: string
          group_id: string
          group_type: string
          id: string
          is_suppressed: boolean
          responses_count: number
        }
        Insert: {
          avg_score: number
          campaign_id: string
          dimension_id: string
          group_id: string
          group_type: string
          id?: string
          is_suppressed?: boolean
          responses_count?: number
        }
        Update: {
          avg_score?: number
          campaign_id?: string
          dimension_id?: string
          group_id?: string
          group_type?: string
          id?: string
          is_suppressed?: boolean
          responses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_scores_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "survey_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_scores_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "survey_dimensions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roles: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      org_units: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_units_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_exports: {
        Row: {
          created_at: string
          created_by: string
          error: string | null
          file_path: string | null
          file_size_bytes: number | null
          id: string
          logs: Json
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          error?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          logs?: Json
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          error?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          logs?: Json
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string | null
          id: string
          must_change_password: boolean
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          campaign_id: string
          file_url: string | null
          generated_at: string
          generated_by: string | null
          id: string
          report_type: string
          tenant_id: string
          version: number
        }
        Insert: {
          campaign_id: string
          file_url?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          report_type: string
          tenant_id: string
          version?: number
        }
        Update: {
          campaign_id?: string
          file_url?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          report_type?: string
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reports_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "survey_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      response_scores: {
        Row: {
          dimension_id: string
          id: string
          items_count: number
          response_id: string
          score: number
        }
        Insert: {
          dimension_id: string
          id?: string
          items_count?: number
          response_id: string
          score: number
        }
        Update: {
          dimension_id?: string
          id?: string
          items_count?: number
          response_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "response_scores_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "survey_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_scores_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_alerts: {
        Row: {
          alert_type: string
          campaign_id: string
          created_at: string
          dimension_id: string | null
          dimension_name: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          score: number
          tenant_id: string
        }
        Insert: {
          alert_type?: string
          campaign_id: string
          created_at?: string
          dimension_id?: string | null
          dimension_name: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          score: number
          tenant_id: string
        }
        Update: {
          alert_type?: string
          campaign_id?: string
          created_at?: string
          dimension_id?: string | null
          dimension_name?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          score?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_alerts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "survey_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_alerts_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "survey_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_answers: {
        Row: {
          id: string
          item_id: string
          response_id: string
          value: number
        }
        Insert: {
          id?: string
          item_id: string
          response_id: string
          value: number
        }
        Update: {
          id?: string
          item_id?: string
          response_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "survey_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_campaigns: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          invite_message: string | null
          name: string
          starts_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          template_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          invite_message?: string | null
          name: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          invite_message?: string | null
          name?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_dimensions: {
        Row: {
          description: string | null
          id: string
          name: string
          sort_order: number
          template_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          template_id: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_dimensions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_invitations: {
        Row: {
          campaign_id: string
          created_at: string
          employee_id: string
          id: string
          is_used: boolean
          token: string
          used_at: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          employee_id: string
          id?: string
          is_used?: boolean
          token?: string
          used_at?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          is_used?: boolean
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_invitations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "survey_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_invitations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_items: {
        Row: {
          dimension_id: string
          id: string
          is_inverted: boolean
          sort_order: number
          text: string
        }
        Insert: {
          dimension_id: string
          id?: string
          is_inverted?: boolean
          sort_order?: number
          text: string
        }
        Update: {
          dimension_id?: string
          id?: string
          is_inverted?: boolean
          sort_order?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_items_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "survey_dimensions"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          campaign_id: string
          completed_at: string | null
          created_at: string
          department_id: string | null
          id: string
          is_complete: boolean
          job_role_id: string | null
          org_unit_id: string | null
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          is_complete?: boolean
          job_role_id?: string | null
          org_unit_id?: string | null
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          is_complete?: boolean
          job_role_id?: string | null
          org_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "survey_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_global: boolean
          name: string
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          name: string
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "survey_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          data_retention_days: number | null
          id: string
          logo_url: string | null
          min_group_size: number
          name: string
          primary_color: string | null
          secondary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_retention_days?: number | null
          id?: string
          logo_url?: string | null
          min_group_size?: number
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_retention_days?: number | null
          id?: string
          logo_url?: string | null
          min_group_size?: number
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      export_dump_schema: { Args: never; Returns: Json }
      export_list_public_tables: {
        Args: never
        Returns: {
          table_name: string
        }[]
      }
      get_employee_metadata_by_token: {
        Args: { _token: string }
        Returns: {
          department_id: string
          job_role_id: string
          org_unit_id: string
        }[]
      }
      get_user_department_id: { Args: { _user_id: string }; Returns: string }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      action_status: "pending" | "in_progress" | "completed"
      app_role: "admin_rh" | "gestor" | "diretoria" | "auditoria"
      campaign_status: "draft" | "active" | "closed" | "archived" | "scheduled"
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
      action_status: ["pending", "in_progress", "completed"],
      app_role: ["admin_rh", "gestor", "diretoria", "auditoria"],
      campaign_status: ["draft", "active", "closed", "archived", "scheduled"],
    },
  },
} as const
