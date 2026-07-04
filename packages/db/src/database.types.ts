/**
 * Database types — mirrors the Supabase Postgres schema exactly.
 * Keep in sync with migrations. Run `pnpm db:generate-types` to regenerate
 * from a live Supabase instance once credentials are configured.
 *
 * Convention:
 *   Row    — shape returned by SELECT
 *   Insert — shape for INSERT (id/timestamps optional)
 *   Update — shape for UPDATE (all fields optional)
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// ---------------------------------------------------------------------------
// Enum types (mirrors CHECK constraints in migrations)
// ---------------------------------------------------------------------------

export type AuthProvider = "email" | "google" | "apple";

export type YearEntryType = "travel" | "away" | "birthday";
export type AvailabilityStatus = "available" | "away" | "partial";

export type CalendarEventType = "meeting" | "appointment" | "birthday" | "renewal" | "other";
export type CalendarEventStatus = "upcoming" | "completed" | "cancelled" | "missed";
export type CalendarEventSourceType =
  | "calendar"
  | "meeting_planner"
  | "year_entry"
  | "expense_recurring";

export type AnnualGoalSection = "business" | "career" | "personal";
export type AnnualGoalStatus =
  | "not_started"
  | "active"
  | "on_track"
  | "at_risk"
  | "completed"
  | "dropped";

export type MonthlyPrioritySection = "business_career" | "personal";
export type MonthlyPriorityStatus = "planned" | "in_progress" | "on_hold" | "completed" | "dropped";
export type ProgressMode = "manual" | "auto_project";

export type ProjectStatus = "planned" | "in_progress" | "on_hold" | "completed" | "cancelled";
export type MilestoneStatus = "pending" | "completed" | "missed";
export type ResourceType =
  | "budget"
  | "employee"
  | "contractor"
  | "new_hire"
  | "tool_software"
  | "equipment"
  | "other";
export type ResourceStatus =
  | "needed"
  | "requested"
  | "approved"
  | "acquired"
  | "delayed"
  | "cancelled";

export type ContactCategory =
  | "personal"
  | "professional"
  | "family"
  | "client"
  | "vendor"
  | "other";

export type MeetingStatus = "upcoming" | "completed" | "missed" | "cancelled";
export type RecurrenceRule = "daily" | "weekly" | "monthly";

export type ActivitySection = "work" | "outside" | "delegated" | "unplanned";
export type ActivityPriority = "A" | "B";
export type ActivityStatus =
  | "not_started"
  | "working"
  | "completed"
  | "postponed"
  | "delegated"
  | "cancelled";
export type ActivityOriginType = "manual" | "project" | "carry_forward";

export type ScheduleSourceType = "activity" | "meeting" | "appointment" | "other";
export type ScheduleInstanceStatus = "upcoming" | "working" | "completed" | "postponed" | "missed";
export type CyclePhase = "focus" | "break" | "completed" | "abandoned";
export type SixTimeProblemStatus = "active" | "retired";

export type ExpenseCategory =
  | "personal"
  | "business"
  | "travel"
  | "food"
  | "transport"
  | "subscriptions"
  | "household"
  | "other";

export type ReminderType =
  | "eod_review"
  | "meeting_upcoming"
  | "meeting_passed"
  | "renewal"
  | "birthday"
  | "travel"
  | "morning_summary"
  | "activity_starting"
  | "activity_overdue"
  | "event_upcoming"
  | "weekly_someday_review"
  | "meeting_prep"
  | "six_time_slot"
  | "six_time_nightly"
  | "giving_daily";

// ---------------------------------------------------------------------------
// Table row types
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          auth_provider: AuthProvider;
          timezone: string;
          eod_review_time: string | null; // "HH:MM"
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string; // must match auth.users(id)
          name?: string;
          email: string;
          auth_provider?: AuthProvider;
          timezone?: string;
          eod_review_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };

      annual_goals: {
        Row: {
          id: string;
          user_id: string;
          section: AnnualGoalSection;
          title: string;
          description: string;
          why_it_matters: string;
          target_date: string | null;
          progress_percent: number;
          status: AnnualGoalStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          section: AnnualGoalSection;
          title: string;
          description?: string;
          why_it_matters?: string;
          target_date?: string | null;
          progress_percent?: number;
          status?: AnnualGoalStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["annual_goals"]["Insert"], "user_id">>;
      };

      contacts: {
        Row: {
          id: string;
          user_id: string;
          category: ContactCategory;
          full_name: string;
          company: string | null;
          role: string | null;
          phone: string | null;
          email: string | null;
          note: string | null;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category?: ContactCategory;
          full_name: string;
          company?: string | null;
          role?: string | null;
          phone?: string | null;
          email?: string | null;
          note?: string | null;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["contacts"]["Insert"], "user_id">>;
      };

      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          status: ProjectStatus;
          start_date: string | null;
          target_end_date: string | null;
          linked_annual_goal_id: string | null;
          linked_monthly_priority_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          status?: ProjectStatus;
          start_date?: string | null;
          target_end_date?: string | null;
          linked_annual_goal_id?: string | null;
          linked_monthly_priority_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["projects"]["Insert"], "user_id">>;
      };

      year_entries: {
        Row: {
          id: string;
          user_id: string;
          type: YearEntryType;
          title: string;
          start_date: string;
          end_date: string | null;
          location: string | null;
          note: string | null;
          availability_status: AvailabilityStatus | null;
          create_linked_trip_plan: boolean;
          linked_project_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: YearEntryType;
          title: string;
          start_date: string;
          end_date?: string | null;
          location?: string | null;
          note?: string | null;
          availability_status?: AvailabilityStatus | null;
          create_linked_trip_plan?: boolean;
          linked_project_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["year_entries"]["Insert"], "user_id">>;
      };

      project_milestones: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          target_date: string | null;
          status: MilestoneStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          target_date?: string | null;
          status?: MilestoneStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["project_milestones"]["Insert"], "project_id">>;
      };

      project_resources: {
        Row: {
          id: string;
          project_id: string;
          resource_type: ResourceType;
          title: string;
          note: string | null;
          estimated_cost: number | null;
          status: ResourceStatus;
          assigned_contact_id: string | null;
          needed_by_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          resource_type: ResourceType;
          title: string;
          note?: string | null;
          estimated_cost?: number | null;
          status?: ResourceStatus;
          assigned_contact_id?: string | null;
          needed_by_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["project_resources"]["Insert"], "project_id">>;
      };

      monthly_priorities: {
        Row: {
          id: string;
          user_id: string;
          section: MonthlyPrioritySection;
          title: string;
          category: string | null;
          started_date: string | null;
          assigned_date: string | null;
          target_date: string | null;
          linked_annual_goal_id: string | null;
          linked_project_id: string | null;
          progress_mode: ProgressMode;
          manual_progress_percent: number | null;
          status: MonthlyPriorityStatus;
          note: string | null;
          pinned: boolean;
          month_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          section: MonthlyPrioritySection;
          title: string;
          category?: string | null;
          started_date?: string | null;
          assigned_date?: string | null;
          target_date?: string | null;
          linked_annual_goal_id?: string | null;
          linked_project_id?: string | null;
          progress_mode?: ProgressMode;
          manual_progress_percent?: number | null;
          status?: MonthlyPriorityStatus;
          note?: string | null;
          pinned?: boolean;
          month_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["monthly_priorities"]["Insert"], "user_id">>;
      };

      meetings: {
        Row: {
          id: string;
          user_id: string;
          linked_contact_id: string;
          linked_calendar_event_id: string | null;
          title: string;
          date: string;
          start_at: string;
          end_at: string;
          duration_minutes: number;
          agenda: string;
          key_takeaways: string | null;
          recurrence_rule: RecurrenceRule | null;
          status: MeetingStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          linked_contact_id: string;
          linked_calendar_event_id?: string | null;
          title: string;
          date: string;
          start_at: string;
          end_at: string;
          duration_minutes: number;
          agenda?: string;
          key_takeaways?: string | null;
          recurrence_rule?: RecurrenceRule | null;
          status?: MeetingStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["meetings"]["Insert"], "user_id">>;
      };

      calendar_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: CalendarEventType;
          title: string;
          date: string;
          start_at: string | null;
          end_at: string | null;
          duration_minutes: number | null;
          linked_contact_id: string | null;
          linked_project_id: string | null;
          linked_meeting_id: string | null;
          linked_year_entry_id: string | null;
          linked_expense_id: string | null;
          location: string | null;
          notes: string | null;
          recurrence_rule: RecurrenceRule | null;
          status: CalendarEventStatus;
          source_type: CalendarEventSourceType;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: CalendarEventType;
          title: string;
          date: string;
          start_at?: string | null;
          end_at?: string | null;
          duration_minutes?: number | null;
          linked_contact_id?: string | null;
          linked_project_id?: string | null;
          linked_meeting_id?: string | null;
          linked_year_entry_id?: string | null;
          linked_expense_id?: string | null;
          location?: string | null;
          notes?: string | null;
          recurrence_rule?: RecurrenceRule | null;
          status?: CalendarEventStatus;
          source_type?: CalendarEventSourceType;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["calendar_events"]["Insert"], "user_id">>;
      };

      activities: {
        Row: {
          id: string;
          user_id: string;
          section_type: ActivitySection;
          title: string;
          priority: ActivityPriority | null;
          activity_date: string;
          estimated_minutes: number;
          remaining_minutes: number;
          status: ActivityStatus;
          linked_project_id: string | null;
          delegated_contact_id: string | null;
          note: string | null;
          origin_type: ActivityOriginType | null;
          moved_from_date: string | null;
          hours_worked: number;
          archived: boolean;
          is_someday: boolean;
          recurrence_rule: "daily" | "weekly" | "monthly" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          section_type: ActivitySection;
          title: string;
          priority?: ActivityPriority | null;
          activity_date: string;
          estimated_minutes?: number;
          remaining_minutes?: number;
          status?: ActivityStatus;
          linked_project_id?: string | null;
          delegated_contact_id?: string | null;
          note?: string | null;
          origin_type?: ActivityOriginType | null;
          moved_from_date?: string | null;
          hours_worked?: number;
          archived?: boolean;
          is_someday?: boolean;
          recurrence_rule?: "daily" | "weekly" | "monthly" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["activities"]["Insert"], "user_id">>;
      };

      schedule_instances: {
        Row: {
          id: string;
          user_id: string;
          source_type: ScheduleSourceType;
          source_activity_id: string | null;
          source_meeting_id: string | null;
          source_event_id: string | null;
          schedule_date: string;
          start_at: string;
          end_at: string;
          locked_minutes: number;
          focus_minutes: number | null;
          status_snapshot: ScheduleInstanceStatus | null;
          keep_as_history: boolean;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_type: ScheduleSourceType;
          source_activity_id?: string | null;
          source_meeting_id?: string | null;
          source_event_id?: string | null;
          schedule_date: string;
          start_at: string;
          end_at: string;
          locked_minutes: number;
          focus_minutes?: number | null;
          status_snapshot?: ScheduleInstanceStatus | null;
          keep_as_history?: boolean;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["schedule_instances"]["Insert"], "user_id">>;
      };

      cycles: {
        Row: {
          id: string;
          user_id: string;
          activity_id: string;
          schedule_instance_id: string | null;
          soft_target_minutes: number | null;
          elapsed_focus_minutes: number;
          segment_started_at: string | null;
          break_count: number;
          phase: CyclePhase;
          started_at: string;
          completed_at: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          activity_id: string;
          schedule_instance_id?: string | null;
          soft_target_minutes?: number | null;
          elapsed_focus_minutes?: number;
          segment_started_at?: string | null;
          break_count?: number;
          phase?: CyclePhase;
          started_at?: string;
          completed_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["cycles"]["Insert"], "user_id">>;
      };

      activity_moves: {
        Row: {
          id: string;
          user_id: string;
          activity_id: string;
          from_date: string;
          to_date: string;
          reason: string | null;
          moved_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          activity_id: string;
          from_date: string;
          to_date: string;
          reason?: string | null;
          moved_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["activity_moves"]["Insert"], "user_id">>;
      };

      six_time_problems: {
        Row: {
          id: string;
          user_id: string;
          position: number;
          problem: string;
          solution: string;
          reminder_phrase: string;
          status: SixTimeProblemStatus;
          created_at: string;
          retired_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          position: number;
          problem: string;
          solution: string;
          reminder_phrase: string;
          status?: SixTimeProblemStatus;
          created_at?: string;
          retired_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["six_time_problems"]["Insert"], "user_id">>;
      };

      six_time_entries: {
        Row: {
          id: string;
          user_id: string;
          entry_date: string;
          problem_id: string;
          plus: string | null;
          minus: string | null;
          todo: string | null;
          logged_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entry_date: string;
          problem_id: string;
          plus?: string | null;
          minus?: string | null;
          todo?: string | null;
          logged_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["six_time_entries"]["Insert"], "user_id">>;
      };

      six_time_nightly_reviews: {
        Row: {
          id: string;
          user_id: string;
          review_date: string;
          best: string[];
          worst: string[];
          logged_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          review_date: string;
          best?: string[];
          worst?: string[];
          logged_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["six_time_nightly_reviews"]["Insert"], "user_id">>;
      };

      six_time_config: {
        Row: {
          id: string;
          user_id: string;
          enabled: boolean;
          daily_log_time: string;
          nightly_time: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          enabled?: boolean;
          daily_log_time?: string;
          nightly_time?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["six_time_config"]["Insert"], "user_id">>;
      };

      giving_challenges: {
        Row: {
          id: string;
          user_id: string;
          start_date: string;
          mode: "challenge" | "continuous";
          status: "active" | "completed" | "abandoned";
          reviewed_at: string | null;
          continue_decision: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_date: string;
          mode?: "challenge" | "continuous";
          status?: "active" | "completed" | "abandoned";
          reviewed_at?: string | null;
          continue_decision?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["giving_challenges"]["Insert"], "user_id">>;
      };

      giving_logs: {
        Row: {
          id: string;
          user_id: string;
          challenge_id: string;
          entry_date: string;
          kind: "given" | "received" | "cognition";
          content: string;
          categories: string[];
          given_in_secret: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          challenge_id: string;
          entry_date: string;
          kind: "given" | "received" | "cognition";
          content: string;
          categories?: string[];
          given_in_secret?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["giving_logs"]["Insert"], "user_id">>;
      };

      expenses: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          merchant_payee: string | null;
          amount: number;
          expense_date: string;
          category: ExpenseCategory;
          payment_method: string | null;
          note: string | null;
          linked_project_id: string | null;
          linked_contact_id: string | null;
          linked_year_entry_id: string | null;
          recurrence_rule: RecurrenceRule | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          merchant_payee?: string | null;
          amount: number;
          expense_date: string;
          category?: ExpenseCategory;
          payment_method?: string | null;
          note?: string | null;
          linked_project_id?: string | null;
          linked_contact_id?: string | null;
          linked_year_entry_id?: string | null;
          recurrence_rule?: RecurrenceRule | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["expenses"]["Insert"], "user_id">>;
      };

      reminder_preferences: {
        Row: {
          id: string;
          user_id: string;
          eod_review_enabled: boolean;
          eod_review_time: string;
          meeting_reminder_minutes_before: number;
          morning_summary_enabled: boolean;
          morning_summary_time: string;
          birthday_reminder_days_before: number;
          travel_reminder_days_before: number;
          renewal_reminder_days_before: number;
          activity_starting_enabled: boolean;
          activity_reminder_minutes_before: number;
          activity_overdue_enabled: boolean;
          event_reminder_minutes_before: number;
          someday_review_enabled: boolean;
          someday_review_weekday: number;
          someday_review_time: string;
          meeting_prep_enabled: boolean;
          meeting_prep_days_before: number;
          meeting_buffer_minutes: number;
          giving_reminder_enabled: boolean;
          giving_reminder_time: string;
          currency_code: string; // ISO 4217, app-wide expense display currency
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          eod_review_enabled?: boolean;
          eod_review_time?: string;
          meeting_reminder_minutes_before?: number;
          morning_summary_enabled?: boolean;
          morning_summary_time?: string;
          birthday_reminder_days_before?: number;
          travel_reminder_days_before?: number;
          renewal_reminder_days_before?: number;
          activity_starting_enabled?: boolean;
          activity_reminder_minutes_before?: number;
          activity_overdue_enabled?: boolean;
          event_reminder_minutes_before?: number;
          someday_review_enabled?: boolean;
          someday_review_weekday?: number;
          someday_review_time?: string;
          meeting_prep_enabled?: boolean;
          meeting_prep_days_before?: number;
          meeting_buffer_minutes?: number;
          giving_reminder_enabled?: boolean;
          giving_reminder_time?: string;
          currency_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["reminder_preferences"]["Insert"], "user_id">>;
      };

      expense_budgets: {
        Row: {
          id: string;
          user_id: string;
          month: string; // "YYYY-MM"
          amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
          amount?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["expense_budgets"]["Insert"], "user_id">>;
      };

      calendar_month_notes: {
        Row: {
          id: string;
          user_id: string;
          month_key: string; // "YYYY-MM"
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_key: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["calendar_month_notes"]["Insert"], "user_id">>;
      };

      reminder_instances: {
        Row: {
          id: string;
          user_id: string;
          reminder_type: ReminderType;
          source_id: string | null;
          scheduled_for: string;
          fired_at: string | null;
          dismissed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          reminder_type: ReminderType;
          source_id?: string | null;
          scheduled_for: string;
          fired_at?: string | null;
          dismissed_at?: string | null;
          created_at?: string;
        };
        Update: Pick<
          Database["public"]["Tables"]["reminder_instances"]["Row"],
          "fired_at" | "dismissed_at"
        >;
      };
    };
  };
}

// ---------------------------------------------------------------------------
// Convenience type aliases (Row types)
// ---------------------------------------------------------------------------
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type AnnualGoalRow = Database["public"]["Tables"]["annual_goals"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type YearEntryRow = Database["public"]["Tables"]["year_entries"]["Row"];
export type ProjectMilestoneRow = Database["public"]["Tables"]["project_milestones"]["Row"];
export type ProjectResourceRow = Database["public"]["Tables"]["project_resources"]["Row"];
export type MonthlyPriorityRow = Database["public"]["Tables"]["monthly_priorities"]["Row"];
export type MeetingRow = Database["public"]["Tables"]["meetings"]["Row"];
export type CalendarEventRow = Database["public"]["Tables"]["calendar_events"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
export type ScheduleInstanceRow = Database["public"]["Tables"]["schedule_instances"]["Row"];
export type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
export type ExpenseBudgetRow = Database["public"]["Tables"]["expense_budgets"]["Row"];
export type CalendarMonthNoteRow = Database["public"]["Tables"]["calendar_month_notes"]["Row"];
export type ReminderPreferenceRow = Database["public"]["Tables"]["reminder_preferences"]["Row"];
export type ReminderInstanceRow = Database["public"]["Tables"]["reminder_instances"]["Row"];

// Insert type aliases
export type InsertProfile = Database["public"]["Tables"]["profiles"]["Insert"];
export type InsertAnnualGoal = Database["public"]["Tables"]["annual_goals"]["Insert"];
export type InsertContact = Database["public"]["Tables"]["contacts"]["Insert"];
export type InsertProject = Database["public"]["Tables"]["projects"]["Insert"];
export type InsertYearEntry = Database["public"]["Tables"]["year_entries"]["Insert"];
export type InsertProjectMilestone = Database["public"]["Tables"]["project_milestones"]["Insert"];
export type InsertProjectResource = Database["public"]["Tables"]["project_resources"]["Insert"];
export type InsertMonthlyPriority = Database["public"]["Tables"]["monthly_priorities"]["Insert"];
export type InsertMeeting = Database["public"]["Tables"]["meetings"]["Insert"];
export type InsertCalendarEvent = Database["public"]["Tables"]["calendar_events"]["Insert"];
export type InsertActivity = Database["public"]["Tables"]["activities"]["Insert"];
export type InsertScheduleInstance = Database["public"]["Tables"]["schedule_instances"]["Insert"];
export type InsertExpense = Database["public"]["Tables"]["expenses"]["Insert"];
export type InsertExpenseBudget = Database["public"]["Tables"]["expense_budgets"]["Insert"];
export type InsertCalendarMonthNote = Database["public"]["Tables"]["calendar_month_notes"]["Insert"];
export type InsertReminderPreference = Database["public"]["Tables"]["reminder_preferences"]["Insert"];
export type InsertReminderInstance = Database["public"]["Tables"]["reminder_instances"]["Insert"];
