import { io } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MembershipRole } from "@/lib/supabase/database.types";

export type StaffContext = {
  userId: string;
  role: Extract<MembershipRole, "admin" | "teacher">;
  institute: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    logo_path: string | null;
    timezone: string;
  };
  fullName: string | null;
};

export async function getStaff(): Promise<StaffContext | null> {
  // Session checks compare token expiry to the current time. io() keeps that
  // out of the static shell without blocking link prefetch the way connection() does.
  await io();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_institute_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.active_institute_id) {
    return null;
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("profile_id", user.id)
    .eq("institute_id", profile.active_institute_id)
    .maybeSingle();

  if (membership?.role !== "admin" && membership?.role !== "teacher") {
    return null;
  }

  const { data: institute } = await supabase
    .from("institutes")
    .select("id, name, phone, address, logo_path, timezone")
    .eq("id", profile.active_institute_id)
    .maybeSingle();

  if (!institute) {
    return null;
  }

  return {
    userId: user.id,
    role: membership.role,
    institute,
    fullName: profile.full_name,
  };
}

export type ParentContext = {
  userId: string;
  institute: {
    id: string;
    name: string;
    logo_path: string | null;
  };
  fullName: string | null;
};

export async function getParent(): Promise<ParentContext | null> {
  await io();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_institute_id, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.active_institute_id) {
    return null;
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("profile_id", user.id)
    .eq("institute_id", profile.active_institute_id)
    .maybeSingle();
  if (membership?.role !== "parent") {
    return null;
  }

  const { data: institute } = await supabase
    .from("institutes")
    .select("id, name, logo_path")
    .eq("id", profile.active_institute_id)
    .maybeSingle();
  if (!institute) {
    return null;
  }

  return {
    userId: user.id,
    institute,
    fullName: profile.full_name,
  };
}
