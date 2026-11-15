import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const PHOTO_BUCKET = "student-photos";

// Short-lived links to student photos, keyed by storage path. Paths the
// caller cannot read come back without a link.
export async function signedPhotoUrls(
  supabase: SupabaseClient<Database>,
  paths: (string | null)[],
  seconds = 60 * 30,
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const urls = new Map<string, string>();
  if (wanted.length === 0) {
    return urls;
  }
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(wanted, seconds);
  if (error) {
    console.error("signedPhotoUrls", error.message);
    return urls;
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) {
      urls.set(item.path, item.signedUrl);
    }
  }
  return urls;
}
