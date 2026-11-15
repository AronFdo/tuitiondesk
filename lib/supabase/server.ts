import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export async function createClient() {
  const env = getPublicEnv();
  if (!env.ok) {
    throw new Error(env.error);
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.data.NEXT_PUBLIC_SUPABASE_URL,
    env.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component. The proxy refreshes the session.
          }
        },
      },
    },
  );
}
