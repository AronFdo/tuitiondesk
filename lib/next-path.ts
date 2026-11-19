// A path inside this site to go to after signing in, or the dashboard.
// Anything that could lead off the site ("//other.site", "/\\other.site",
// "https://…") is replaced. Safe to use in the browser.
export function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/dashboard";
  }
  return next;
}
