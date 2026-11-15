// Matches supabase/sql/001 through 014.
// After you run those files, replace this with output from
// `supabase gen types typescript --project-id <id>`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MembershipRole = "admin" | "teacher" | "student" | "parent";

export type Database = {
  public: {
    Tables: {
      institutes: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          address: string | null;
          logo_path: string | null;
          timezone: string;
          tuition_due_day: number | null;
          receipt_paper_mm: number;
          receipt_footer: string | null;
          exam_due_on: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          address?: string | null;
          logo_path?: string | null;
          timezone?: string;
          tuition_due_day?: number | null;
          receipt_paper_mm?: number;
          receipt_footer?: string | null;
          exam_due_on?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          address?: string | null;
          logo_path?: string | null;
          timezone?: string;
          tuition_due_day?: number | null;
          receipt_paper_mm?: number;
          receipt_footer?: string | null;
          exam_due_on?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          email: string | null;
          active_institute_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          email?: string | null;
          active_institute_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          email?: string | null;
          active_institute_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          institute_id: string;
          profile_id: string;
          role: MembershipRole;
          last_seen_at: string | null;
          previous_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          profile_id: string;
          role: MembershipRole;
          last_seen_at?: string | null;
          previous_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institute_id?: string;
          profile_id?: string;
          role?: MembershipRole;
          last_seen_at?: string | null;
          previous_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_members: {
        Row: {
          id: string;
          institute_id: string;
          profile_id: string | null;
          full_name: string;
          title: string | null;
          phone: string | null;
          email: string | null;
          nic: string | null;
          address: string | null;
          subjects: string | null;
          joined_on: string | null;
          left_on: string | null;
          notes: string | null;
          status: string;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          profile_id?: string | null;
          full_name: string;
          title?: string | null;
          phone?: string | null;
          email?: string | null;
          nic?: string | null;
          address?: string | null;
          subjects?: string | null;
          joined_on?: string | null;
          left_on?: string | null;
          notes?: string | null;
          status?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institute_id?: string;
          profile_id?: string | null;
          full_name?: string;
          title?: string | null;
          phone?: string | null;
          email?: string | null;
          nic?: string | null;
          address?: string | null;
          subjects?: string | null;
          joined_on?: string | null;
          left_on?: string | null;
          notes?: string | null;
          status?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          institute_id: string;
          actor_profile_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          actor_profile_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institute_id?: string;
          actor_profile_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          institute_id: string;
          name: string;
          board: string;
          level: string | null;
          format: string;
          exam_date: string | null;
          exam_fee_minor: number;
          late_fee_minor: number | null;
          registration_opens_on: string | null;
          registration_closes_on: string | null;
          late_closes_on: string | null;
          speaking_from: string | null;
          speaking_to: string | null;
          venue: string | null;
          catalogue_session_id: string | null;
          teacher_profile_id: string | null;
          schedule_text: string | null;
          monthly_fee_minor: number;
          tuition_due_day: number | null;
          exam_due_on: string | null;
          description: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          name: string;
          board?: string;
          level?: string | null;
          format?: string;
          exam_date?: string | null;
          exam_fee_minor?: number;
          late_fee_minor?: number | null;
          registration_opens_on?: string | null;
          registration_closes_on?: string | null;
          late_closes_on?: string | null;
          speaking_from?: string | null;
          speaking_to?: string | null;
          venue?: string | null;
          catalogue_session_id?: string | null;
          teacher_profile_id?: string | null;
          schedule_text?: string | null;
          monthly_fee_minor?: number;
          tuition_due_day?: number | null;
          exam_due_on?: string | null;
          description?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institute_id?: string;
          name?: string;
          board?: string;
          level?: string | null;
          format?: string;
          exam_date?: string | null;
          exam_fee_minor?: number;
          late_fee_minor?: number | null;
          registration_opens_on?: string | null;
          registration_closes_on?: string | null;
          late_closes_on?: string | null;
          speaking_from?: string | null;
          speaking_to?: string | null;
          venue?: string | null;
          catalogue_session_id?: string | null;
          teacher_profile_id?: string | null;
          schedule_text?: string | null;
          monthly_fee_minor?: number;
          tuition_due_day?: number | null;
          exam_due_on?: string | null;
          description?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      receipts: {
        Row: {
          id: string;
          institute_id: string;
          receipt_no: number;
          student_id: string;
          tuition_payment_id: string;
          total_minor: number;
          issued_at: string;
          issued_by: string | null;
          print_count: number;
          last_printed_at: string | null;
          voided_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      class_sessions: {
        Row: {
          id: string;
          institute_id: string;
          course_id: string;
          held_on: string;
          opened_at: string;
          opened_by: string | null;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          institute_id: string;
          session_id: string;
          course_id: string;
          student_id: string;
          scanned_at: string;
          source: "scanner" | "camera" | "manual";
          recorded_by: string | null;
          voided_at: string | null;
          voided_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          institute_id: string;
          full_name: string;
          guardian_name: string | null;
          guardian_phone: string | null;
          date_of_birth: string | null;
          gender: string | null;
          id_type: string | null;
          id_number: string | null;
          name_on_certificate: string | null;
          notes: string | null;
          student_code: string;
          qr_token: string;
          qr_issued_at: string | null;
          photo_path: string | null;
          first_name: string | null;
          last_name: string | null;
          nic: string | null;
          religion: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          occupation: string | null;
          qualification: string | null;
          school: string | null;
          medium: string | null;
          ol_results: string | null;
          al_results: string | null;
          father_name: string | null;
          father_occupation: string | null;
          mother_name: string | null;
          mother_occupation: string | null;
          guardian_occupation: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          learning_mode: string | null;
          has_special_needs: boolean;
          special_needs: string | null;
          left_on: string | null;
          leave_reason: string | null;
          leave_note: string | null;
          portal_enabled: boolean;
          status: string;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          full_name: string;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          id_type?: string | null;
          id_number?: string | null;
          name_on_certificate?: string | null;
          notes?: string | null;
          student_code?: string;
          qr_token?: string;
          qr_issued_at?: string | null;
          photo_path?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          nic?: string | null;
          religion?: string | null;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          occupation?: string | null;
          qualification?: string | null;
          school?: string | null;
          medium?: string | null;
          ol_results?: string | null;
          al_results?: string | null;
          father_name?: string | null;
          father_occupation?: string | null;
          mother_name?: string | null;
          mother_occupation?: string | null;
          guardian_occupation?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          learning_mode?: string | null;
          has_special_needs?: boolean;
          special_needs?: string | null;
          left_on?: string | null;
          leave_reason?: string | null;
          leave_note?: string | null;
          portal_enabled?: boolean;
          status?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institute_id?: string;
          full_name?: string;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          id_type?: string | null;
          id_number?: string | null;
          name_on_certificate?: string | null;
          notes?: string | null;
          student_code?: string;
          qr_token?: string;
          qr_issued_at?: string | null;
          photo_path?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          nic?: string | null;
          religion?: string | null;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          occupation?: string | null;
          qualification?: string | null;
          school?: string | null;
          medium?: string | null;
          ol_results?: string | null;
          al_results?: string | null;
          father_name?: string | null;
          father_occupation?: string | null;
          mother_name?: string | null;
          mother_occupation?: string | null;
          guardian_occupation?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          learning_mode?: string | null;
          has_special_needs?: boolean;
          special_needs?: string | null;
          left_on?: string | null;
          leave_reason?: string | null;
          leave_note?: string | null;
          portal_enabled?: boolean;
          status?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      enrollments: {
        Row: {
          id: string;
          institute_id: string;
          course_id: string;
          student_id: string;
          start_date: string;
          end_date: string | null;
          outcome: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          course_id: string;
          student_id: string;
          start_date: string;
          end_date?: string | null;
          outcome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institute_id?: string;
          course_id?: string;
          student_id?: string;
          start_date?: string;
          end_date?: string | null;
          outcome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tuition_payments: {
        Row: {
          id: string;
          institute_id: string;
          course_id: string;
          student_id: string;
          amount_minor: number;
          paid_on: string;
          period_month: string;
          voided_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          course_id: string;
          student_id: string;
          amount_minor: number;
          paid_on: string;
          period_month: string;
          voided_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institute_id?: string;
          course_id?: string;
          student_id?: string;
          amount_minor?: number;
          paid_on?: string;
          period_month?: string;
          voided_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_payments: {
        Row: {
          id: string;
          institute_id: string;
          course_id: string;
          registration_id: string;
          student_id: string;
          amount_minor: number;
          paid_on: string;
          voided_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          course_id: string;
          registration_id: string;
          student_id: string;
          amount_minor: number;
          paid_on: string;
          voided_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institute_id?: string;
          course_id?: string;
          registration_id?: string;
          student_id?: string;
          amount_minor?: number;
          paid_on?: string;
          voided_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      guardian_links: {
        Row: {
          id: string;
          institute_id: string;
          guardian_profile_id: string;
          student_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          guardian_profile_id: string;
          student_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institute_id?: string;
          guardian_profile_id?: string;
          student_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      course_files: {
        Row: {
          id: string;
          institute_id: string;
          course_id: string;
          kind: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          course_id: string;
          kind: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institute_id?: string;
          course_id?: string;
          kind?: string;
          file_name?: string;
          storage_path?: string;
          mime_type?: string;
          size_bytes?: number;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_registrations: {
        Row: {
          id: string;
          institute_id: string;
          course_id: string;
          exam_date: string;
          student_id: string;
          status: string;
          fee_minor: number;
          candidate_number: string | null;
          rex_reference: string | null;
          result: string | null;
          submitted_at: string | null;
          withdrawn_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          course_id: string;
          exam_date: string;
          student_id: string;
          status?: string;
          fee_minor: number;
          candidate_number?: string | null;
          rex_reference?: string | null;
          result?: string | null;
          submitted_at?: string | null;
          withdrawn_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institute_id?: string;
          course_id?: string;
          exam_date?: string;
          student_id?: string;
          status?: string;
          fee_minor?: number;
          candidate_number?: string | null;
          rex_reference?: string | null;
          result?: string | null;
          submitted_at?: string | null;
          withdrawn_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      student_documents: {
        Row: {
          id: string;
          institute_id: string;
          student_id: string;
          registration_id: string | null;
          kind: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          student_id: string;
          registration_id?: string | null;
          kind: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institute_id?: string;
          student_id?: string;
          registration_id?: string | null;
          kind?: string;
          file_name?: string;
          storage_path?: string;
          mime_type?: string;
          size_bytes?: number;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notices: {
        Row: {
          id: string;
          institute_id: string;
          course_id: string | null;
          body: string;
          show_until: string | null;
          created_by: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          course_id?: string | null;
          body: string;
          show_until?: string | null;
          created_by?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institute_id?: string;
          course_id?: string | null;
          body?: string;
          show_until?: string | null;
          created_by?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_catalogue_fees: {
        Row: {
          id: string;
          board: string;
          level: string;
          valid_from: string;
          valid_to: string;
          fee_minor: number;
          late_fee_minor: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          board: string;
          level: string;
          valid_from: string;
          valid_to: string;
          fee_minor: number;
          late_fee_minor: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          board?: string;
          level?: string;
          valid_from?: string;
          valid_to?: string;
          fee_minor?: number;
          late_fee_minor?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_catalogue_sessions: {
        Row: {
          id: string;
          board: string;
          level: string;
          format: string;
          location: string;
          exam_date: string;
          speaking_from: string | null;
          speaking_to: string | null;
          registration_opens_on: string;
          registration_closes_on: string;
          late_closes_on: string;
          source: string;
          withdrawn_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          board: string;
          level: string;
          format: string;
          location: string;
          exam_date: string;
          speaking_from?: string | null;
          speaking_to?: string | null;
          registration_opens_on: string;
          registration_closes_on: string;
          late_closes_on: string;
          source: string;
          withdrawn_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          board?: string;
          level?: string;
          format?: string;
          location?: string;
          exam_date?: string;
          speaking_from?: string | null;
          speaking_to?: string | null;
          registration_opens_on?: string;
          registration_closes_on?: string;
          late_closes_on?: string;
          source?: string;
          withdrawn_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      record_tuition_payment: {
        Args: {
          p_course_id: string;
          p_student_id: string;
          p_amount_minor: number;
          p_paid_on: string;
          p_period_month: string;
        };
        Returns: Json;
      };
      mark_receipt_printed: {
        Args: { p_receipt_id: string };
        Returns: number;
      };
      open_class_session: {
        Args: { p_course_id: string; p_held_on: string };
        Returns: string;
      };
      close_class_session: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      record_scan: {
        Args: { p_session_id: string; p_token: string; p_source: string; p_scanned_at: string };
        Returns: Json;
      };
      set_attendance: {
        Args: { p_session_id: string; p_student_id: string; p_present: boolean };
        Returns: undefined;
      };
      import_students: {
        Args: { p_rows: Json; p_start_date: string };
        // The new students' ids, in the order of p_rows.
        Returns: Json;
      };
      new_qr_token: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      touch_last_seen: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      current_institute_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      current_role: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      parent_has_student: {
        Args: { p_student_id: string };
        Returns: boolean;
      };
      parent_can_read_course: {
        Args: { p_course_id: string };
        Returns: boolean;
      };
      overdue_tuition_minor: {
        Args: { p_today?: string };
        Returns: number;
      };
      create_student: {
        Args: { p_data: Json; p_course_ids: string[]; p_start_date: string };
        Returns: string;
      };
      set_student_courses: {
        Args: {
          p_student_id: string;
          p_course_ids: string[];
          p_on?: string;
          p_outcomes?: Json;
        };
        Returns: undefined;
      };
      mark_student_left: {
        Args: {
          p_student_id: string;
          p_left_on: string;
          p_reason?: string | null;
          p_note?: string | null;
        };
        Returns: undefined;
      };
      grant_staff_login: {
        Args: { p_staff_id: string; p_profile_id: string; p_role?: string };
        Returns: undefined;
      };
      set_staff_role: {
        Args: { p_staff_id: string; p_role: string };
        Returns: undefined;
      };
      archive_staff_member: {
        Args: { p_staff_id: string; p_left_on?: string | null };
        Returns: undefined;
      };
      restore_staff_member: {
        Args: { p_staff_id: string };
        Returns: undefined;
      };
      set_staff_courses: {
        Args: { p_staff_id: string; p_course_ids: string[] };
        Returns: undefined;
      };
      rejoin_student: {
        Args: { p_student_id: string };
        Returns: undefined;
      };
      has_permission: {
        Args: { p_permission: string };
        Returns: boolean;
      };
      course_fees: {
        Args: { p_course_ids: string[] };
        Returns: {
          course_id: string;
          monthly_fee_minor: number;
          tuition_due_day: number | null;
        }[];
      };
    };
  };
};
