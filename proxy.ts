import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

const appPaths = [
  "/dashboard",
  "/settings",
  "/courses",
  "/students",
  "/payments",
  "/family",
  "/cards",
  "/attendance",
  "/receipts",
];
const guestOnlyPaths = ["/sign-in", "/sign-up"];
const sessionPaths = ["/reset-password", "/accept-invite"];

export async function proxy(request: NextRequest) {
  const env = getPublicEnv();
  if (!env.ok) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.data.NEXT_PUBLIC_SUPABASE_URL,
    env.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Server actions arrive as POSTs to the page they are used on. Redirecting
  // one hands the client an HTML page instead of an action response ("An
  // unexpected response was received from the server"), so only page loads
  // are redirected; every action checks the session itself.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return supabaseResponse;
  }

  const path = request.nextUrl.pathname;
  const destination = nextPath(path, Boolean(user));
  if (!destination) {
    return supabaseResponse;
  }

  const url = request.nextUrl.clone();
  url.pathname = destination;
  const redirectResponse = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

function nextPath(path: string, signedIn: boolean) {
  if (path === "/") {
    return signedIn ? "/dashboard" : "/sign-in";
  }
  if (!signedIn && (appPaths.some((item) => path.startsWith(item)) || sessionPaths.some((item) => path.startsWith(item)))) {
    return path.startsWith("/reset-password") ? "/forgot-password" : "/sign-in";
  }
  if (signedIn && guestOnlyPaths.some((item) => path.startsWith(item))) {
    return "/dashboard";
  }
  return null;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
