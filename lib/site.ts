import { headers } from "next/headers";

export async function getRequestOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) {
    return null;
  }
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// The address printed into card QR codes. Set SITE_URL in production (like
// https://app.tuitiondesk.lk) so cards always point at the live site, never
// at a preview deployment; otherwise the address of the current request.
export async function siteOrigin() {
  const configured = process.env.SITE_URL?.trim();
  if (configured && /^https?:\/\/[^/\s]+\/?$/i.test(configured)) {
    return configured.replace(/\/+$/, "");
  }
  return (await getRequestOrigin()) ?? "";
}

export { safeNextPath } from "@/lib/next-path";
