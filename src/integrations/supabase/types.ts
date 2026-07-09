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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          quotation_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          quotation_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          quotation_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          email: string | null
          follow_up_status: string | null
          id: string
          industry: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          follow_up_status?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          follow_up_status?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      job_orders: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          job_order_number: string
          production_notes: string | null
          production_status: string
          quotation_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          job_order_number?: string
          production_notes?: string | null
          production_status?: string
          quotation_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          job_order_number?: string
          production_notes?: string | null
          production_status?: string
          quotation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          category: string
          id: string
          key: string
          label_ar: string
          meta: Json | null
          unit: string | null
          updated_at: string
          value: number
        }
        Insert: {
          category: string
          id?: string
          key: string
          label_ar: string
          meta?: Json | null
          unit?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          category?: string
          id?: string
          key?: string
          label_ar?: string
          meta?: Json | null
          unit?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_suspended: boolean
          last_login_at: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_suspended?: boolean
          last_login_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_suspended?: boolean
          last_login_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quotation_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          quantity: number
          quotation_id: string
          specs: Json | null
          title: string
          total_price: number
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          quantity?: number
          quotation_id: string
          specs?: Json | null
          title: string
          total_price?: number
          unit_cost?: number | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          quantity?: number
          quotation_id?: string
          specs?: Json | null
          title?: string
          total_price?: number
          unit_cost?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          approval_required: boolean | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          customer_id: string | null
          customer_notes: string | null
          delivery_days: number | null
          discount: number | null
          final_price: number | null
          id: string
          internal_notes: string | null
          payment_terms: string | null
          product_category: string | null
          profit_margin_pct: number | null
          quantity: number | null
          quotation_number: string
          sales_rep_id: string | null
          specs: Json | null
          status: string
          subtotal: number | null
          tax_amount: number
          tax_enabled: boolean
          tax_pct: number
          total_cost: number | null
          unit_price: number
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          approval_required?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_notes?: string | null
          delivery_days?: number | null
          discount?: number | null
          final_price?: number | null
          id?: string
          internal_notes?: string | null
          payment_terms?: string | null
          product_category?: string | null
          profit_margin_pct?: number | null
          quantity?: number | null
          quotation_number: string
          sales_rep_id?: string | null
          specs?: Json | null
          status?: string
          subtotal?: number | null
          tax_amount?: number
          tax_enabled?: boolean
          tax_pct?: number
          total_cost?: number | null
          unit_price?: number
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          approval_required?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_notes?: string | null
          delivery_days?: number | null
          discount?: number | null
          final_price?: number | null
          id?: string
          internal_notes?: string | null
          payment_terms?: string | null
          product_category?: string | null
          profit_margin_pct?: number | null
          quantity?: number | null
          quotation_number?: string
          sales_rep_id?: string | null
          specs?: Json | null
          status?: string
          subtotal?: number | null
          tax_amount?: number
          tax_enabled?: boolean
          tax_pct?: number
          total_cost?: number | null
          unit_price?: number
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          granted: boolean
          permission_key: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          granted?: boolean
          permission_key: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          granted?: boolean
          permission_key?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: { _key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      next_job_order_number: { Args: never; Returns: string }
      next_quotation_number: { Args: never; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "sales_manager"
        | "sales_rep"
        | "finance"
        | "production_viewer"
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
      app_role: [
        "admin",
        "sales_manager",
        "sales_rep",
        "finance",
        "production_viewer",
      ],
    },
  },
} as const
