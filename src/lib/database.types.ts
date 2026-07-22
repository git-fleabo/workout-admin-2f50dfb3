export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activity_types: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      admin_people: {
        Row: {
          admin_person_id: string;
          created_at: string;
          id: string;
          managed_person_id: string;
          role: string;
        };
        Insert: {
          admin_person_id: string;
          created_at?: string;
          id?: string;
          managed_person_id: string;
          role?: string;
        };
        Update: {
          admin_person_id?: string;
          created_at?: string;
          id?: string;
          managed_person_id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_people_admin_person_id_fkey";
            columns: ["admin_person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_people_managed_person_id_fkey";
            columns: ["managed_person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      app_profiles: {
        Row: {
          config: Json;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          config?: Json;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bodyweight_logs: {
        Row: {
          bodyweight: number;
          created_at: string;
          id: string;
          logged_date: string;
          notes: string | null;
          person_id: string;
          source_row: number | null;
          source_sheet: string | null;
        };
        Insert: {
          bodyweight: number;
          created_at?: string;
          id?: string;
          logged_date: string;
          notes?: string | null;
          person_id: string;
          source_row?: number | null;
          source_sheet?: string | null;
        };
        Update: {
          bodyweight?: number;
          created_at?: string;
          id?: string;
          logged_date?: string;
          notes?: string | null;
          person_id?: string;
          source_row?: number | null;
          source_sheet?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bodyweight_logs_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_rotation_assignments: {
        Row: {
          assigned_date: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          item_id: string;
          person_id: string;
        };
        Insert: {
          assigned_date?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          item_id: string;
          person_id: string;
        };
        Update: {
          assigned_date?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          item_id?: string;
          person_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_rotation_assignments_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "daily_rotation_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_rotation_assignments_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_rotation_items: {
        Row: {
          active_days: number[];
          created_at: string;
          cue: string | null;
          id: string;
          is_active: boolean;
          minimum_days_between: number;
          name: string;
          person_id: string;
          selection_weight: number;
          sort_order: number;
          target: string | null;
          updated_at: string;
        };
        Insert: {
          active_days?: number[];
          created_at?: string;
          cue?: string | null;
          id?: string;
          is_active?: boolean;
          minimum_days_between?: number;
          name: string;
          person_id: string;
          selection_weight?: number;
          sort_order?: number;
          target?: string | null;
          updated_at?: string;
        };
        Update: {
          active_days?: number[];
          created_at?: string;
          cue?: string | null;
          id?: string;
          is_active?: boolean;
          minimum_days_between?: number;
          name?: string;
          person_id?: string;
          selection_weight?: number;
          sort_order?: number;
          target?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_rotation_items_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      entry_metrics: {
        Row: {
          created_at: string;
          id: string;
          metric_key: string;
          metric_text: string | null;
          metric_unit: string | null;
          metric_value: number | null;
          session_entry_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          metric_key: string;
          metric_text?: string | null;
          metric_unit?: string | null;
          metric_value?: number | null;
          session_entry_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          metric_key?: string;
          metric_text?: string | null;
          metric_unit?: string | null;
          metric_value?: number | null;
          session_entry_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entry_metrics_session_entry_id_fkey";
            columns: ["session_entry_id"];
            isOneToOne: false;
            referencedRelation: "session_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      entry_set_segments: {
        Row: {
          config: Json;
          created_at: string;
          entry_set_id: string;
          id: string;
          method_name: string;
          range_of_motion: string | null;
          reps: number | null;
          rest_after_seconds: number | null;
          rpe: number | null;
          segment_index: number;
          training_method_id: string;
          weight: number | null;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          entry_set_id: string;
          id?: string;
          method_name: string;
          range_of_motion?: string | null;
          reps?: number | null;
          rest_after_seconds?: number | null;
          rpe?: number | null;
          segment_index?: number;
          training_method_id: string;
          weight?: number | null;
        };
        Update: {
          config?: Json;
          created_at?: string;
          entry_set_id?: string;
          id?: string;
          method_name?: string;
          range_of_motion?: string | null;
          reps?: number | null;
          rest_after_seconds?: number | null;
          rpe?: number | null;
          segment_index?: number;
          training_method_id?: string;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "entry_set_segments_entry_set_id_fkey";
            columns: ["entry_set_id"];
            isOneToOne: false;
            referencedRelation: "entry_sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entry_set_segments_training_method_id_fkey";
            columns: ["training_method_id"];
            isOneToOne: false;
            referencedRelation: "training_methods";
            referencedColumns: ["id"];
          },
        ];
      };
      entry_sets: {
        Row: {
          assistance_detail: string | null;
          assistance_type: string | null;
          completed: boolean;
          created_at: string;
          distance: number | null;
          distance_unit: string | null;
          duration_seconds: number | null;
          id: string;
          notes: string | null;
          quality: string | null;
          reps: number | null;
          rest_seconds: number | null;
          rest_time: string | null;
          rpe: number | null;
          session_entry_id: string;
          set_number: number | null;
          weight: number | null;
        };
        Insert: {
          assistance_detail?: string | null;
          assistance_type?: string | null;
          completed?: boolean;
          created_at?: string;
          distance?: number | null;
          distance_unit?: string | null;
          duration_seconds?: number | null;
          id?: string;
          notes?: string | null;
          quality?: string | null;
          reps?: number | null;
          rest_seconds?: number | null;
          rest_time?: string | null;
          rpe?: number | null;
          session_entry_id: string;
          set_number?: number | null;
          weight?: number | null;
        };
        Update: {
          assistance_detail?: string | null;
          assistance_type?: string | null;
          completed?: boolean;
          created_at?: string;
          distance?: number | null;
          distance_unit?: string | null;
          duration_seconds?: number | null;
          id?: string;
          notes?: string | null;
          quality?: string | null;
          reps?: number | null;
          rest_seconds?: number | null;
          rest_time?: string | null;
          rpe?: number | null;
          session_entry_id?: string;
          set_number?: number | null;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "entry_sets_session_entry_id_fkey";
            columns: ["session_entry_id"];
            isOneToOne: false;
            referencedRelation: "session_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      equipment_items: {
        Row: {
          category: string;
          circuit_group: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          person_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          category?: string;
          circuit_group?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          person_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          category?: string;
          circuit_group?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          person_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "equipment_items_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      exercise_tag_links: {
        Row: {
          exercise_id: string;
          tag_id: string;
        };
        Insert: {
          exercise_id: string;
          tag_id: string;
        };
        Update: {
          exercise_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_tag_links_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_tag_links_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "exercise_tags";
            referencedColumns: ["id"];
          },
        ];
      };
      exercise_tags: {
        Row: {
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          activity_type_id: string | null;
          circuit_difficulty: string;
          circuit_dose_max: number | null;
          circuit_dose_min: number | null;
          circuit_dose_mode: string;
          circuit_dose_per_side: boolean;
          circuit_impact: string;
          circuit_pattern: string;
          circuit_suitability: string;
          created_at: string;
          default_metric: string | null;
          equipment: string | null;
          focus_area: string | null;
          id: string;
          is_active: boolean;
          name: string;
          notes: string | null;
          source_row: number | null;
          source_sheet: string | null;
          suggested_reps: string | null;
          suggested_sets: string | null;
          updated_at: string;
        };
        Insert: {
          activity_type_id?: string | null;
          circuit_difficulty?: string;
          circuit_dose_max?: number | null;
          circuit_dose_min?: number | null;
          circuit_dose_mode?: string;
          circuit_dose_per_side?: boolean;
          circuit_impact?: string;
          circuit_pattern?: string;
          circuit_suitability?: string;
          created_at?: string;
          default_metric?: string | null;
          equipment?: string | null;
          focus_area?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          source_row?: number | null;
          source_sheet?: string | null;
          suggested_reps?: string | null;
          suggested_sets?: string | null;
          updated_at?: string;
        };
        Update: {
          activity_type_id?: string | null;
          circuit_difficulty?: string;
          circuit_dose_max?: number | null;
          circuit_dose_min?: number | null;
          circuit_dose_mode?: string;
          circuit_dose_per_side?: boolean;
          circuit_impact?: string;
          circuit_pattern?: string;
          circuit_suitability?: string;
          created_at?: string;
          default_metric?: string | null;
          equipment?: string | null;
          focus_area?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          source_row?: number | null;
          source_sheet?: string | null;
          suggested_reps?: string | null;
          suggested_sets?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exercises_activity_type_id_fkey";
            columns: ["activity_type_id"];
            isOneToOne: false;
            referencedRelation: "activity_types";
            referencedColumns: ["id"];
          },
        ];
      };
      goal_checkins: {
        Row: {
          checked_date: string;
          created_at: string;
          goal_id: string;
          id: string;
          note: string | null;
          person_id: string;
        };
        Insert: {
          checked_date?: string;
          created_at?: string;
          goal_id: string;
          id?: string;
          note?: string | null;
          person_id: string;
        };
        Update: {
          checked_date?: string;
          created_at?: string;
          goal_id?: string;
          id?: string;
          note?: string | null;
          person_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_checkins_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goal_checkins_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          created_at: string;
          deadline: string | null;
          exercise_id: string | null;
          goal: string;
          goal_metric: string | null;
          goal_type: string;
          id: string;
          metric: string | null;
          notes: string | null;
          period: string | null;
          person_id: string;
          source_row: number | null;
          source_sheet: string | null;
          starting_value: number | null;
          status: string;
          target: string | null;
          target_unit: string | null;
          target_value: number | null;
          tracking_mode: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deadline?: string | null;
          exercise_id?: string | null;
          goal: string;
          goal_metric?: string | null;
          goal_type?: string;
          id?: string;
          metric?: string | null;
          notes?: string | null;
          period?: string | null;
          person_id: string;
          source_row?: number | null;
          source_sheet?: string | null;
          starting_value?: number | null;
          status?: string;
          target?: string | null;
          target_unit?: string | null;
          target_value?: number | null;
          tracking_mode?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deadline?: string | null;
          exercise_id?: string | null;
          goal?: string;
          goal_metric?: string | null;
          goal_type?: string;
          id?: string;
          metric?: string | null;
          notes?: string | null;
          period?: string | null;
          person_id?: string;
          source_row?: number | null;
          source_sheet?: string | null;
          starting_value?: number | null;
          status?: string;
          target?: string | null;
          target_unit?: string | null;
          target_value?: number | null;
          tracking_mode?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goals_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      one_rm_tests: {
        Row: {
          bodyweight_contribution: string | null;
          bodyweight_used: boolean;
          created_at: string;
          estimated_external: number | null;
          estimated_total: number | null;
          exercise_id: string | null;
          exercise_name: string;
          external_weight: number | null;
          formula: string | null;
          id: string;
          is_pr: boolean;
          load_type: string | null;
          notes: string | null;
          person_id: string;
          reps: number | null;
          rpe: number | null;
          source: string | null;
          source_row: number | null;
          source_sheet: string | null;
          test_date: string;
          updated_at: string;
        };
        Insert: {
          bodyweight_contribution?: string | null;
          bodyweight_used?: boolean;
          created_at?: string;
          estimated_external?: number | null;
          estimated_total?: number | null;
          exercise_id?: string | null;
          exercise_name: string;
          external_weight?: number | null;
          formula?: string | null;
          id?: string;
          is_pr?: boolean;
          load_type?: string | null;
          notes?: string | null;
          person_id: string;
          reps?: number | null;
          rpe?: number | null;
          source?: string | null;
          source_row?: number | null;
          source_sheet?: string | null;
          test_date: string;
          updated_at?: string;
        };
        Update: {
          bodyweight_contribution?: string | null;
          bodyweight_used?: boolean;
          created_at?: string;
          estimated_external?: number | null;
          estimated_total?: number | null;
          exercise_id?: string | null;
          exercise_name?: string;
          external_weight?: number | null;
          formula?: string | null;
          id?: string;
          is_pr?: boolean;
          load_type?: string | null;
          notes?: string | null;
          person_id?: string;
          reps?: number | null;
          rpe?: number | null;
          source?: string | null;
          source_row?: number | null;
          source_sheet?: string | null;
          test_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "one_rm_tests_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "one_rm_tests_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      people: {
        Row: {
          auth_user_id: string | null;
          created_at: string;
          display_name: string;
          email: string | null;
          id: string;
          notes: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id?: string | null;
          created_at?: string;
          display_name: string;
          email?: string | null;
          id?: string;
          notes?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string | null;
          created_at?: string;
          display_name?: string;
          email?: string | null;
          id?: string;
          notes?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      person_app_profiles: {
        Row: {
          app_profile_id: string;
          created_at: string;
          id: string;
          is_default: boolean;
          person_id: string;
        };
        Insert: {
          app_profile_id: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          person_id: string;
        };
        Update: {
          app_profile_id?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          person_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "person_app_profiles_app_profile_id_fkey";
            columns: ["app_profile_id"];
            isOneToOne: false;
            referencedRelation: "app_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "person_app_profiles_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      person_exercises: {
        Row: {
          created_at: string;
          custom_name: string | null;
          exercise_id: string;
          id: string;
          is_enabled: boolean;
          location_scope: string;
          notes: string | null;
          person_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          custom_name?: string | null;
          exercise_id: string;
          id?: string;
          is_enabled?: boolean;
          location_scope?: string;
          notes?: string | null;
          person_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          custom_name?: string | null;
          exercise_id?: string;
          id?: string;
          is_enabled?: boolean;
          location_scope?: string;
          notes?: string | null;
          person_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "person_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "person_exercises_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      person_training_methods: {
        Row: {
          created_at: string;
          default_config: Json;
          is_enabled: boolean;
          person_id: string;
          training_method_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          default_config?: Json;
          is_enabled?: boolean;
          person_id: string;
          training_method_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_config?: Json;
          is_enabled?: boolean;
          person_id?: string;
          training_method_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "person_training_methods_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "person_training_methods_training_method_id_fkey";
            columns: ["training_method_id"];
            isOneToOne: false;
            referencedRelation: "training_methods";
            referencedColumns: ["id"];
          },
        ];
      };
      program_assignment_exercises: {
        Row: {
          created_at: string | null;
          exercise_id: string | null;
          exercise_name: string;
          id: string;
          notes: string | null;
          one_rm_test_id: string | null;
          program_assignment_id: string;
          slot_key: string;
          training_max: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          exercise_id?: string | null;
          exercise_name: string;
          id?: string;
          notes?: string | null;
          one_rm_test_id?: string | null;
          program_assignment_id: string;
          slot_key: string;
          training_max?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          exercise_id?: string | null;
          exercise_name?: string;
          id?: string;
          notes?: string | null;
          one_rm_test_id?: string | null;
          program_assignment_id?: string;
          slot_key?: string;
          training_max?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "program_assignment_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_assignment_exercises_one_rm_test_id_fkey";
            columns: ["one_rm_test_id"];
            isOneToOne: false;
            referencedRelation: "one_rm_tests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_assignment_exercises_program_assignment_id_fkey";
            columns: ["program_assignment_id"];
            isOneToOne: false;
            referencedRelation: "program_assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      program_assignments: {
        Row: {
          assigned_by_person_id: string | null;
          completed_on: string | null;
          created_at: string;
          current_workout_index: number;
          id: string;
          notes: string | null;
          person_id: string;
          program_id: string;
          started_on: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          assigned_by_person_id?: string | null;
          completed_on?: string | null;
          created_at?: string;
          current_workout_index?: number;
          id?: string;
          notes?: string | null;
          person_id: string;
          program_id: string;
          started_on?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          assigned_by_person_id?: string | null;
          completed_on?: string | null;
          created_at?: string;
          current_workout_index?: number;
          id?: string;
          notes?: string | null;
          person_id?: string;
          program_id?: string;
          started_on?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "program_assignments_assigned_by_person_id_fkey";
            columns: ["assigned_by_person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_assignments_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_assignments_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ];
      };
      program_workout_entries: {
        Row: {
          assistance_detail: string | null;
          assistance_type: string | null;
          created_at: string;
          duration: string | null;
          exercise_id: string | null;
          id: string;
          intensity_percent: number | null;
          is_optional: boolean | null;
          max_reps: number | null;
          max_sets: number | null;
          min_reps: number | null;
          min_sets: number | null;
          name: string;
          notes: string | null;
          order_index: number;
          percent_base: string | null;
          program_workout_id: string;
          progression_level: string | null;
          reps: string | null;
          rest: string | null;
          rounding_increment: number | null;
          rpe: string | null;
          sets: string | null;
          slot_key: string | null;
          updated_at: string;
          weight: string | null;
        };
        Insert: {
          assistance_detail?: string | null;
          assistance_type?: string | null;
          created_at?: string;
          duration?: string | null;
          exercise_id?: string | null;
          id?: string;
          intensity_percent?: number | null;
          is_optional?: boolean | null;
          max_reps?: number | null;
          max_sets?: number | null;
          min_reps?: number | null;
          min_sets?: number | null;
          name: string;
          notes?: string | null;
          order_index?: number;
          percent_base?: string | null;
          program_workout_id: string;
          progression_level?: string | null;
          reps?: string | null;
          rest?: string | null;
          rounding_increment?: number | null;
          rpe?: string | null;
          sets?: string | null;
          slot_key?: string | null;
          updated_at?: string;
          weight?: string | null;
        };
        Update: {
          assistance_detail?: string | null;
          assistance_type?: string | null;
          created_at?: string;
          duration?: string | null;
          exercise_id?: string | null;
          id?: string;
          intensity_percent?: number | null;
          is_optional?: boolean | null;
          max_reps?: number | null;
          max_sets?: number | null;
          min_reps?: number | null;
          min_sets?: number | null;
          name?: string;
          notes?: string | null;
          order_index?: number;
          percent_base?: string | null;
          program_workout_id?: string;
          progression_level?: string | null;
          reps?: string | null;
          rest?: string | null;
          rounding_increment?: number | null;
          rpe?: string | null;
          sets?: string | null;
          slot_key?: string | null;
          updated_at?: string;
          weight?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "program_workout_entries_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_workout_entries_program_workout_id_fkey";
            columns: ["program_workout_id"];
            isOneToOne: false;
            referencedRelation: "program_workouts";
            referencedColumns: ["id"];
          },
        ];
      };
      program_workouts: {
        Row: {
          created_at: string;
          day_number: number | null;
          description: string | null;
          id: string;
          name: string;
          program_id: string;
          sequence_index: number;
          session_number: number | null;
          updated_at: string;
          week_number: number | null;
        };
        Insert: {
          created_at?: string;
          day_number?: number | null;
          description?: string | null;
          id?: string;
          name: string;
          program_id: string;
          sequence_index?: number;
          session_number?: number | null;
          updated_at?: string;
          week_number?: number | null;
        };
        Update: {
          created_at?: string;
          day_number?: number | null;
          description?: string | null;
          id?: string;
          name?: string;
          program_id?: string;
          sequence_index?: number;
          session_number?: number | null;
          updated_at?: string;
          week_number?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "program_workouts_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ];
      };
      programs: {
        Row: {
          created_at: string;
          created_by_person_id: string | null;
          default_set_choice: string | null;
          description: string | null;
          duration_weeks: number | null;
          id: string;
          is_template: boolean;
          method_type: string | null;
          name: string;
          percent_base: string | null;
          rounding_increment: number | null;
          sessions_per_week: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by_person_id?: string | null;
          default_set_choice?: string | null;
          description?: string | null;
          duration_weeks?: number | null;
          id?: string;
          is_template?: boolean;
          method_type?: string | null;
          name: string;
          percent_base?: string | null;
          rounding_increment?: number | null;
          sessions_per_week?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by_person_id?: string | null;
          default_set_choice?: string | null;
          description?: string | null;
          duration_weeks?: number | null;
          id?: string;
          is_template?: boolean;
          method_type?: string | null;
          name?: string;
          percent_base?: string | null;
          rounding_increment?: number | null;
          sessions_per_week?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "programs_created_by_person_id_fkey";
            columns: ["created_by_person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      session_entries: {
        Row: {
          activity_type_id: string | null;
          completed: boolean;
          created_at: string;
          entry_kind: string | null;
          exercise_id: string | null;
          id: string;
          name: string;
          notes: string | null;
          order_index: number;
          progression_level: string | null;
          session_id: string;
          source_row: number | null;
          source_sheet: string | null;
          updated_at: string;
        };
        Insert: {
          activity_type_id?: string | null;
          completed?: boolean;
          created_at?: string;
          entry_kind?: string | null;
          exercise_id?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          order_index?: number;
          progression_level?: string | null;
          session_id: string;
          source_row?: number | null;
          source_sheet?: string | null;
          updated_at?: string;
        };
        Update: {
          activity_type_id?: string | null;
          completed?: boolean;
          created_at?: string;
          entry_kind?: string | null;
          exercise_id?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          order_index?: number;
          progression_level?: string | null;
          session_id?: string;
          source_row?: number | null;
          source_sheet?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_entries_activity_type_id_fkey";
            columns: ["activity_type_id"];
            isOneToOne: false;
            referencedRelation: "activity_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_entries_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_entries_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      session_method_block_entries: {
        Row: {
          block_id: string;
          created_at: string;
          sequence_index: number;
          session_entry_id: string;
        };
        Insert: {
          block_id: string;
          created_at?: string;
          sequence_index?: number;
          session_entry_id: string;
        };
        Update: {
          block_id?: string;
          created_at?: string;
          sequence_index?: number;
          session_entry_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_method_block_entries_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "session_method_blocks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_method_block_entries_session_entry_id_fkey";
            columns: ["session_entry_id"];
            isOneToOne: false;
            referencedRelation: "session_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      session_method_blocks: {
        Row: {
          block_duration_seconds: number | null;
          completed_rounds: number | null;
          config: Json;
          created_at: string;
          family: string;
          id: string;
          method_name: string;
          order_index: number;
          rest_between_movements_seconds: number | null;
          rest_between_rounds_seconds: number | null;
          rest_interval_seconds: number | null;
          rounds: number | null;
          session_id: string;
          training_method_id: string;
          work_interval_seconds: number | null;
        };
        Insert: {
          block_duration_seconds?: number | null;
          completed_rounds?: number | null;
          config?: Json;
          created_at?: string;
          family: string;
          id?: string;
          method_name: string;
          order_index?: number;
          rest_between_movements_seconds?: number | null;
          rest_between_rounds_seconds?: number | null;
          rest_interval_seconds?: number | null;
          rounds?: number | null;
          session_id: string;
          training_method_id: string;
          work_interval_seconds?: number | null;
        };
        Update: {
          block_duration_seconds?: number | null;
          completed_rounds?: number | null;
          config?: Json;
          created_at?: string;
          family?: string;
          id?: string;
          method_name?: string;
          order_index?: number;
          rest_between_movements_seconds?: number | null;
          rest_between_rounds_seconds?: number | null;
          rest_interval_seconds?: number | null;
          rounds?: number | null;
          session_id?: string;
          training_method_id?: string;
          work_interval_seconds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "session_method_blocks_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_method_blocks_training_method_id_fkey";
            columns: ["training_method_id"];
            isOneToOne: false;
            referencedRelation: "training_methods";
            referencedColumns: ["id"];
          },
        ];
      };
      sessions: {
        Row: {
          activity_type_id: string | null;
          completed: boolean;
          created_at: string;
          duration_minutes: number | null;
          id: string;
          intensity: string | null;
          notes: string | null;
          person_id: string;
          rpe: number | null;
          session_date: string;
          source: string;
          source_row: number | null;
          source_sheet: string | null;
          title: string | null;
          training_location_id: string | null;
          updated_at: string;
        };
        Insert: {
          activity_type_id?: string | null;
          completed?: boolean;
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          intensity?: string | null;
          notes?: string | null;
          person_id: string;
          rpe?: number | null;
          session_date: string;
          source?: string;
          source_row?: number | null;
          source_sheet?: string | null;
          title?: string | null;
          training_location_id?: string | null;
          updated_at?: string;
        };
        Update: {
          activity_type_id?: string | null;
          completed?: boolean;
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          intensity?: string | null;
          notes?: string | null;
          person_id?: string;
          rpe?: number | null;
          session_date?: string;
          source?: string;
          source_row?: number | null;
          source_sheet?: string | null;
          title?: string | null;
          training_location_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_activity_type_id_fkey";
            columns: ["activity_type_id"];
            isOneToOne: false;
            referencedRelation: "activity_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_training_location_id_fkey";
            columns: ["training_location_id"];
            isOneToOne: false;
            referencedRelation: "training_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      simple_strength_in_progress_sessions: {
        Row: {
          adjustments: Json;
          app_profile_id: string;
          created_at: string;
          id: string;
          internal_notes: string | null;
          last_updated_at: string;
          person_id: string;
          results: Json;
          session_date: string;
          session_name: string;
          started_at: string;
          template_key: string;
          updated_at: string;
        };
        Insert: {
          adjustments?: Json;
          app_profile_id: string;
          created_at?: string;
          id?: string;
          internal_notes?: string | null;
          last_updated_at?: string;
          person_id: string;
          results?: Json;
          session_date: string;
          session_name: string;
          started_at?: string;
          template_key: string;
          updated_at?: string;
        };
        Update: {
          adjustments?: Json;
          app_profile_id?: string;
          created_at?: string;
          id?: string;
          internal_notes?: string | null;
          last_updated_at?: string;
          person_id?: string;
          results?: Json;
          session_date?: string;
          session_name?: string;
          started_at?: string;
          template_key?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simple_strength_in_progress_sessions_app_profile_id_fkey";
            columns: ["app_profile_id"];
            isOneToOne: false;
            referencedRelation: "app_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simple_strength_in_progress_sessions_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      simple_strength_messages: {
        Row: {
          app_profile_id: string;
          created_at: string;
          frequency: string | null;
          id: string;
          is_active: boolean;
          message_key: string;
          message_text: string;
          message_type: string | null;
          screen: string | null;
          trigger: string | null;
          updated_at: string;
        };
        Insert: {
          app_profile_id: string;
          created_at?: string;
          frequency?: string | null;
          id?: string;
          is_active?: boolean;
          message_key: string;
          message_text: string;
          message_type?: string | null;
          screen?: string | null;
          trigger?: string | null;
          updated_at?: string;
        };
        Update: {
          app_profile_id?: string;
          created_at?: string;
          frequency?: string | null;
          id?: string;
          is_active?: boolean;
          message_key?: string;
          message_text?: string;
          message_type?: string | null;
          screen?: string | null;
          trigger?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simple_strength_messages_app_profile_id_fkey";
            columns: ["app_profile_id"];
            isOneToOne: false;
            referencedRelation: "app_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      simple_strength_personal_bests: {
        Row: {
          achieved_on: string | null;
          best_type: string;
          best_unit: string | null;
          best_value: string;
          category: string | null;
          created_at: string;
          exercise_id: string | null;
          exercise_name: string;
          id: string;
          person_id: string;
          source_exercise_key: string | null;
          source_notes: string | null;
          updated_at: string;
        };
        Insert: {
          achieved_on?: string | null;
          best_type: string;
          best_unit?: string | null;
          best_value: string;
          category?: string | null;
          created_at?: string;
          exercise_id?: string | null;
          exercise_name: string;
          id?: string;
          person_id: string;
          source_exercise_key?: string | null;
          source_notes?: string | null;
          updated_at?: string;
        };
        Update: {
          achieved_on?: string | null;
          best_type?: string;
          best_unit?: string | null;
          best_value?: string;
          category?: string | null;
          created_at?: string;
          exercise_id?: string | null;
          exercise_name?: string;
          id?: string;
          person_id?: string;
          source_exercise_key?: string | null;
          source_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simple_strength_personal_bests_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simple_strength_personal_bests_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      simple_strength_progression_configs: {
        Row: {
          app_profile_id: string;
          config_key: string;
          created_at: string;
          done_streak_required: number;
          id: string;
          minimum_weight_kg: number;
          rep_range_high: number;
          rep_range_low: number;
          rep_step: number;
          reset_target_on_weight_bump: boolean;
          skipped_changes_progression: boolean;
          time_range_high_seconds: number;
          time_range_low_seconds: number;
          time_step_seconds: number;
          too_hard_keeps_weight: boolean;
          updated_at: string;
          weight_input_step_kg: number;
          weight_step_kg: number;
        };
        Insert: {
          app_profile_id: string;
          config_key: string;
          created_at?: string;
          done_streak_required?: number;
          id?: string;
          minimum_weight_kg?: number;
          rep_range_high?: number;
          rep_range_low?: number;
          rep_step?: number;
          reset_target_on_weight_bump?: boolean;
          skipped_changes_progression?: boolean;
          time_range_high_seconds?: number;
          time_range_low_seconds?: number;
          time_step_seconds?: number;
          too_hard_keeps_weight?: boolean;
          updated_at?: string;
          weight_input_step_kg?: number;
          weight_step_kg?: number;
        };
        Update: {
          app_profile_id?: string;
          config_key?: string;
          created_at?: string;
          done_streak_required?: number;
          id?: string;
          minimum_weight_kg?: number;
          rep_range_high?: number;
          rep_range_low?: number;
          rep_step?: number;
          reset_target_on_weight_bump?: boolean;
          skipped_changes_progression?: boolean;
          time_range_high_seconds?: number;
          time_range_low_seconds?: number;
          time_step_seconds?: number;
          too_hard_keeps_weight?: boolean;
          updated_at?: string;
          weight_input_step_kg?: number;
          weight_step_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: "simple_strength_progression_configs_app_profile_id_fkey";
            columns: ["app_profile_id"];
            isOneToOne: false;
            referencedRelation: "app_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      simple_strength_progression_state: {
        Row: {
          category: string | null;
          config_id: string | null;
          created_at: string;
          current_difficulty: string | null;
          current_target: string | null;
          current_weight: number | null;
          exercise_id: string | null;
          exercise_name: string;
          id: string;
          is_active: boolean;
          last_completed_date: string | null;
          last_progression_impact: string | null;
          last_result_status: string | null;
          next_difficulty: string | null;
          next_target: string | null;
          next_weight: number | null;
          person_id: string;
          progression_note: string | null;
          session_pattern: string | null;
          source_exercise_key: string | null;
          successful_streak: number;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          config_id?: string | null;
          created_at?: string;
          current_difficulty?: string | null;
          current_target?: string | null;
          current_weight?: number | null;
          exercise_id?: string | null;
          exercise_name: string;
          id?: string;
          is_active?: boolean;
          last_completed_date?: string | null;
          last_progression_impact?: string | null;
          last_result_status?: string | null;
          next_difficulty?: string | null;
          next_target?: string | null;
          next_weight?: number | null;
          person_id: string;
          progression_note?: string | null;
          session_pattern?: string | null;
          source_exercise_key?: string | null;
          successful_streak?: number;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          config_id?: string | null;
          created_at?: string;
          current_difficulty?: string | null;
          current_target?: string | null;
          current_weight?: number | null;
          exercise_id?: string | null;
          exercise_name?: string;
          id?: string;
          is_active?: boolean;
          last_completed_date?: string | null;
          last_progression_impact?: string | null;
          last_result_status?: string | null;
          next_difficulty?: string | null;
          next_target?: string | null;
          next_weight?: number | null;
          person_id?: string;
          progression_note?: string | null;
          session_pattern?: string | null;
          source_exercise_key?: string | null;
          successful_streak?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simple_strength_progression_state_config_id_fkey";
            columns: ["config_id"];
            isOneToOne: false;
            referencedRelation: "simple_strength_progression_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simple_strength_progression_state_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simple_strength_progression_state_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      simple_strength_rotation_rule_variations: {
        Row: {
          created_at: string;
          exercise_id: string | null;
          exercise_name: string;
          id: string;
          rotation_rule_id: string;
          sort_order: number;
          source_exercise_key: string | null;
        };
        Insert: {
          created_at?: string;
          exercise_id?: string | null;
          exercise_name: string;
          id?: string;
          rotation_rule_id: string;
          sort_order?: number;
          source_exercise_key?: string | null;
        };
        Update: {
          created_at?: string;
          exercise_id?: string | null;
          exercise_name?: string;
          id?: string;
          rotation_rule_id?: string;
          sort_order?: number;
          source_exercise_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "simple_strength_rotation_rule_variations_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simple_strength_rotation_rule_variations_rotation_rule_id_fkey";
            columns: ["rotation_rule_id"];
            isOneToOne: false;
            referencedRelation: "simple_strength_rotation_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      simple_strength_rotation_rules: {
        Row: {
          app_profile_id: string;
          avoid_repeating: boolean;
          created_at: string;
          default_exercise_id: string | null;
          default_exercise_name: string;
          default_source_exercise_key: string | null;
          id: string;
          is_active: boolean;
          pattern: string;
          person_id: string | null;
          rotation_style: string;
          session_name: string;
          updated_at: string;
          use_default_first: boolean;
        };
        Insert: {
          app_profile_id: string;
          avoid_repeating?: boolean;
          created_at?: string;
          default_exercise_id?: string | null;
          default_exercise_name: string;
          default_source_exercise_key?: string | null;
          id?: string;
          is_active?: boolean;
          pattern: string;
          person_id?: string | null;
          rotation_style?: string;
          session_name: string;
          updated_at?: string;
          use_default_first?: boolean;
        };
        Update: {
          app_profile_id?: string;
          avoid_repeating?: boolean;
          created_at?: string;
          default_exercise_id?: string | null;
          default_exercise_name?: string;
          default_source_exercise_key?: string | null;
          id?: string;
          is_active?: boolean;
          pattern?: string;
          person_id?: string | null;
          rotation_style?: string;
          session_name?: string;
          updated_at?: string;
          use_default_first?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "simple_strength_rotation_rules_app_profile_id_fkey";
            columns: ["app_profile_id"];
            isOneToOne: false;
            referencedRelation: "app_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simple_strength_rotation_rules_default_exercise_id_fkey";
            columns: ["default_exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simple_strength_rotation_rules_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      simple_strength_settings: {
        Row: {
          app_profile_id: string;
          created_at: string;
          description: string | null;
          id: string;
          setting_key: string;
          setting_value: Json;
          updated_at: string;
        };
        Insert: {
          app_profile_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          setting_key: string;
          setting_value?: Json;
          updated_at?: string;
        };
        Update: {
          app_profile_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          setting_key?: string;
          setting_value?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simple_strength_settings_app_profile_id_fkey";
            columns: ["app_profile_id"];
            isOneToOne: false;
            referencedRelation: "app_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      simple_strength_template_entries: {
        Row: {
          created_at: string;
          display_order: number;
          exercise_id: string | null;
          exercise_name: string;
          id: string;
          is_active: boolean;
          optional_finisher: boolean;
          pattern: string | null;
          required_for_full: boolean;
          section: string;
          slot: number;
          source_exercise_key: string | null;
          template_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          exercise_id?: string | null;
          exercise_name: string;
          id?: string;
          is_active?: boolean;
          optional_finisher?: boolean;
          pattern?: string | null;
          required_for_full?: boolean;
          section: string;
          slot?: number;
          source_exercise_key?: string | null;
          template_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          exercise_id?: string | null;
          exercise_name?: string;
          id?: string;
          is_active?: boolean;
          optional_finisher?: boolean;
          pattern?: string | null;
          required_for_full?: boolean;
          section?: string;
          slot?: number;
          source_exercise_key?: string | null;
          template_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simple_strength_template_entries_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simple_strength_template_entries_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "simple_strength_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      simple_strength_template_entry_variations: {
        Row: {
          created_at: string;
          exercise_id: string | null;
          exercise_name: string;
          id: string;
          sort_order: number;
          source_exercise_key: string | null;
          template_entry_id: string;
        };
        Insert: {
          created_at?: string;
          exercise_id?: string | null;
          exercise_name: string;
          id?: string;
          sort_order?: number;
          source_exercise_key?: string | null;
          template_entry_id: string;
        };
        Update: {
          created_at?: string;
          exercise_id?: string | null;
          exercise_name?: string;
          id?: string;
          sort_order?: number;
          source_exercise_key?: string | null;
          template_entry_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simple_strength_template_entry_variation_template_entry_id_fkey";
            columns: ["template_entry_id"];
            isOneToOne: false;
            referencedRelation: "simple_strength_template_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simple_strength_template_entry_variations_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
        ];
      };
      simple_strength_templates: {
        Row: {
          app_profile_id: string;
          created_at: string;
          estimate_text: string | null;
          focus: string | null;
          id: string;
          is_active: boolean;
          reason: string | null;
          session_name: string;
          template_key: string;
          updated_at: string;
        };
        Insert: {
          app_profile_id: string;
          created_at?: string;
          estimate_text?: string | null;
          focus?: string | null;
          id?: string;
          is_active?: boolean;
          reason?: string | null;
          session_name: string;
          template_key: string;
          updated_at?: string;
        };
        Update: {
          app_profile_id?: string;
          created_at?: string;
          estimate_text?: string | null;
          focus?: string | null;
          id?: string;
          is_active?: boolean;
          reason?: string | null;
          session_name?: string;
          template_key?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simple_strength_templates_app_profile_id_fkey";
            columns: ["app_profile_id"];
            isOneToOne: false;
            referencedRelation: "app_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      suggested_workout_entries: {
        Row: {
          created_at: string;
          exercise_id: string | null;
          id: string;
          name: string;
          order_index: number;
          reason: string | null;
          source_date: string | null;
          suggested_workout_id: string;
          target_metrics: Json;
          tracking_mode: string | null;
          updated_at: string;
          workout_type: string | null;
        };
        Insert: {
          created_at?: string;
          exercise_id?: string | null;
          id?: string;
          name: string;
          order_index?: number;
          reason?: string | null;
          source_date?: string | null;
          suggested_workout_id: string;
          target_metrics?: Json;
          tracking_mode?: string | null;
          updated_at?: string;
          workout_type?: string | null;
        };
        Update: {
          created_at?: string;
          exercise_id?: string | null;
          id?: string;
          name?: string;
          order_index?: number;
          reason?: string | null;
          source_date?: string | null;
          suggested_workout_id?: string;
          target_metrics?: Json;
          tracking_mode?: string | null;
          updated_at?: string;
          workout_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "suggested_workout_entries_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suggested_workout_entries_suggested_workout_id_fkey";
            columns: ["suggested_workout_id"];
            isOneToOne: false;
            referencedRelation: "suggested_workouts";
            referencedColumns: ["id"];
          },
        ];
      };
      suggested_workout_method_block_entries: {
        Row: {
          block_id: string;
          created_at: string;
          sequence_index: number;
          suggested_workout_entry_id: string;
        };
        Insert: {
          block_id: string;
          created_at?: string;
          sequence_index?: number;
          suggested_workout_entry_id: string;
        };
        Update: {
          block_id?: string;
          created_at?: string;
          sequence_index?: number;
          suggested_workout_entry_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suggested_workout_method_block__suggested_workout_entry_id_fkey";
            columns: ["suggested_workout_entry_id"];
            isOneToOne: false;
            referencedRelation: "suggested_workout_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suggested_workout_method_block_entries_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "suggested_workout_method_blocks";
            referencedColumns: ["id"];
          },
        ];
      };
      suggested_workout_method_blocks: {
        Row: {
          block_duration_seconds: number | null;
          config: Json;
          created_at: string;
          family: string;
          id: string;
          method_name: string;
          order_index: number;
          rest_between_movements_seconds: number | null;
          rest_between_rounds_seconds: number | null;
          rest_interval_seconds: number | null;
          rounds: number | null;
          suggested_workout_id: string;
          training_method_id: string;
          work_interval_seconds: number | null;
        };
        Insert: {
          block_duration_seconds?: number | null;
          config?: Json;
          created_at?: string;
          family: string;
          id?: string;
          method_name: string;
          order_index?: number;
          rest_between_movements_seconds?: number | null;
          rest_between_rounds_seconds?: number | null;
          rest_interval_seconds?: number | null;
          rounds?: number | null;
          suggested_workout_id: string;
          training_method_id: string;
          work_interval_seconds?: number | null;
        };
        Update: {
          block_duration_seconds?: number | null;
          config?: Json;
          created_at?: string;
          family?: string;
          id?: string;
          method_name?: string;
          order_index?: number;
          rest_between_movements_seconds?: number | null;
          rest_between_rounds_seconds?: number | null;
          rest_interval_seconds?: number | null;
          rounds?: number | null;
          suggested_workout_id?: string;
          training_method_id?: string;
          work_interval_seconds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "suggested_workout_method_blocks_suggested_workout_id_fkey";
            columns: ["suggested_workout_id"];
            isOneToOne: false;
            referencedRelation: "suggested_workouts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suggested_workout_method_blocks_training_method_id_fkey";
            columns: ["training_method_id"];
            isOneToOne: false;
            referencedRelation: "training_methods";
            referencedColumns: ["id"];
          },
        ];
      };
      suggested_workout_set_segments: {
        Row: {
          config: Json;
          created_at: string;
          id: string;
          method_name: string;
          range_of_motion: string | null;
          reps: number | null;
          rest_after_seconds: number | null;
          rpe: number | null;
          segment_index: number;
          suggested_workout_set_id: string;
          training_method_id: string;
          weight: number | null;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          id?: string;
          method_name: string;
          range_of_motion?: string | null;
          reps?: number | null;
          rest_after_seconds?: number | null;
          rpe?: number | null;
          segment_index?: number;
          suggested_workout_set_id: string;
          training_method_id: string;
          weight?: number | null;
        };
        Update: {
          config?: Json;
          created_at?: string;
          id?: string;
          method_name?: string;
          range_of_motion?: string | null;
          reps?: number | null;
          rest_after_seconds?: number | null;
          rpe?: number | null;
          segment_index?: number;
          suggested_workout_set_id?: string;
          training_method_id?: string;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "suggested_workout_set_segments_suggested_workout_set_id_fkey";
            columns: ["suggested_workout_set_id"];
            isOneToOne: false;
            referencedRelation: "suggested_workout_sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suggested_workout_set_segments_training_method_id_fkey";
            columns: ["training_method_id"];
            isOneToOne: false;
            referencedRelation: "training_methods";
            referencedColumns: ["id"];
          },
        ];
      };
      suggested_workout_sets: {
        Row: {
          completed: boolean;
          created_at: string;
          duration_seconds: number | null;
          id: string;
          reps: number | null;
          rpe: number | null;
          set_number: number;
          suggested_workout_entry_id: string;
          updated_at: string;
          weight: number | null;
        };
        Insert: {
          completed?: boolean;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          reps?: number | null;
          rpe?: number | null;
          set_number: number;
          suggested_workout_entry_id: string;
          updated_at?: string;
          weight?: number | null;
        };
        Update: {
          completed?: boolean;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          reps?: number | null;
          rpe?: number | null;
          set_number?: number;
          suggested_workout_entry_id?: string;
          updated_at?: string;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "suggested_workout_sets_suggested_workout_entry_id_fkey";
            columns: ["suggested_workout_entry_id"];
            isOneToOne: false;
            referencedRelation: "suggested_workout_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      suggested_workouts: {
        Row: {
          basis: string | null;
          completed_session_id: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          person_id: string;
          program_assignment_id: string | null;
          program_workout_id: string | null;
          readiness: string | null;
          status: string;
          suggested_for: string | null;
          title: string;
          training_location_id: string | null;
          updated_at: string;
        };
        Insert: {
          basis?: string | null;
          completed_session_id?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          person_id: string;
          program_assignment_id?: string | null;
          program_workout_id?: string | null;
          readiness?: string | null;
          status?: string;
          suggested_for?: string | null;
          title: string;
          training_location_id?: string | null;
          updated_at?: string;
        };
        Update: {
          basis?: string | null;
          completed_session_id?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          person_id?: string;
          program_assignment_id?: string | null;
          program_workout_id?: string | null;
          readiness?: string | null;
          status?: string;
          suggested_for?: string | null;
          title?: string;
          training_location_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suggested_workouts_completed_session_id_fkey";
            columns: ["completed_session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suggested_workouts_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suggested_workouts_program_assignment_id_fkey";
            columns: ["program_assignment_id"];
            isOneToOne: false;
            referencedRelation: "program_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suggested_workouts_program_workout_id_fkey";
            columns: ["program_workout_id"];
            isOneToOne: false;
            referencedRelation: "program_workouts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suggested_workouts_training_location_id_fkey";
            columns: ["training_location_id"];
            isOneToOne: false;
            referencedRelation: "training_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      training_location_equipment: {
        Row: {
          created_at: string;
          equipment_item_id: string;
          location_id: string;
        };
        Insert: {
          created_at?: string;
          equipment_item_id: string;
          location_id: string;
        };
        Update: {
          created_at?: string;
          equipment_item_id?: string;
          location_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_location_equipment_equipment_item_id_fkey";
            columns: ["equipment_item_id"];
            isOneToOne: false;
            referencedRelation: "equipment_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_location_equipment_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "training_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      training_locations: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          kind: string;
          name: string;
          person_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          name: string;
          person_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          name?: string;
          person_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_locations_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      training_methods: {
        Row: {
          created_at: string;
          default_config: Json;
          description: string | null;
          family: string;
          id: string;
          is_active: boolean;
          name: string;
          person_id: string | null;
          system_key: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          default_config?: Json;
          description?: string | null;
          family: string;
          id?: string;
          is_active?: boolean;
          name: string;
          person_id?: string | null;
          system_key?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_config?: Json;
          description?: string | null;
          family?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          person_id?: string | null;
          system_key?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_methods_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_suggested_workout: {
        Args: { p_session_id: string; p_workout_id: string };
        Returns: {
          assignment_status: string;
          current_workout_index: number;
          program_assignment_id: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
