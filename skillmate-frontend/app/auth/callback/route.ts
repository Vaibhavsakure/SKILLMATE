import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  // Derive the browser-facing origin from the Host header, NOT request.url.
  // Inside Docker standalone, request.url is http://0.0.0.0:3000 (container HOSTNAME)
  // but the browser actually sent Host: localhost:3000.
  const hostHeader = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${hostHeader}`;


  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check user metadata for role-based redirect
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role;

      if (role === "recruiter") {
        return NextResponse.redirect(`${origin}/recruiter/dashboard`);
      }

      // If no role set (OAuth user without role), send to select-role page
      if (!role) {
        return NextResponse.redirect(`${origin}/auth/select-role`);
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // Return the user to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}