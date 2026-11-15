"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export function createClient() {
  const env = getPublicEnv();
  if (!env.ok) {
    throw new Error(env.error);
  }

  return createBrowserClient<Database>(
    env.data.NEXT_PUBLIC_SUPABASE_URL,
    env.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
