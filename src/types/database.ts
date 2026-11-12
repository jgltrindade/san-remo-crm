/**
 * Tipos do banco no formato esperado pelo supabase-js.
 * Espelham as migrations em supabase/migrations. Podem ser regenerados com:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'manager' | 'broker';
export type LeadStage = 'new' | 'contacting' | 'scheduled' | 'proposal' | 'won' | 'lost';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          name?: string;
          email?: string;
          role?: UserRole;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          name: string;
          phone: string;
          email: string | null;
          origin: string;
          interest: string;
          stage: LeadStage;
          assigned_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          email?: string | null;
          origin: string;
          interest: string;
          stage?: LeadStage;
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          phone?: string;
          email?: string | null;
          origin?: string;
          interest?: string;
          stage?: LeadStage;
          assigned_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'leads_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      lead_notes: {
        Row: {
          id: string;
          lead_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          user_id?: string;
          content: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: 'lead_notes_lead_id_fkey';
            columns: ['lead_id'];
            isOneToOne: false;
            referencedRelation: 'leads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lead_notes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      broker_presence: {
        Row: {
          id: string;
          broker_id: string;
          valid_until: string;
          queue_position: number;
          last_checkin_at: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'broker_presence_broker_id_fkey';
            columns: ['broker_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      distribution_history: {
        Row: {
          id: string;
          lead_id: string;
          broker_id: string;
          distributed_at: string;
          queue_position_at_distribution: number;
          distributed_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'distribution_history_lead_id_fkey';
            columns: ['lead_id'];
            isOneToOne: false;
            referencedRelation: 'leads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'distribution_history_broker_id_fkey';
            columns: ['broker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_manager: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_broker: { Args: Record<PropertyKey, never>; Returns: boolean };
      get_presence_qr: { Args: Record<PropertyKey, never>; Returns: Json };
      check_in_presence: { Args: { p_token: string }; Returns: Json };
      distribute_next_lead: { Args: Record<PropertyKey, never>; Returns: Json };
      get_my_presence: { Args: Record<PropertyKey, never>; Returns: Json };
      get_presence_overview: {
        Args: Record<PropertyKey, never>;
        Returns: {
          broker_id: string;
          name: string;
          email: string;
          is_valid: boolean;
          valid_until: string | null;
          last_checkin_at: string | null;
          queue_position: number | null;
          queue_rank: number | null;
          service_order: number | null;
          is_next: boolean;
          assigned_leads: number;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      lead_stage: LeadStage;
    };
    CompositeTypes: Record<never, never>;
  };
};
