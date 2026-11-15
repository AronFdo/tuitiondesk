import { createClient } from "@/lib/supabase/server";

// A short-lived link to the class logo, for staff and parents alike.
export async function signedLogoUrl(logoPath: string | null) {
  if (!logoPath) {
    return null;
  }
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("institute-logos")
    .createSignedUrl(logoPath, 60 * 10);
  return data?.signedUrl ?? null;
}
