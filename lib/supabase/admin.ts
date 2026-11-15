import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { t } from "@/lib/t";

export function createAdminClient() {
  const env = getPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.ok || !serviceRoleKey) {
    return {
      ok: false as const,
      error: t(
        "Add SUPABASE_SERVICE_ROLE_KEY to .env.local, then restart the dev server.",
      ),
    };
  }

  return {
    ok: true as const,
    client: createClient<Database>(
      env.data.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    ),
  };
}
