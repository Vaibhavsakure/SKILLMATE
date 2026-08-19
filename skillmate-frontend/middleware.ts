import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // 1. Create initial response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 2. Setup Supabase Client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update request cookies (so Server Components see the new session)
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          
          // Re-create response with updated request
          response = NextResponse.next({
            request,
          });
          
          // Write cookies to the final response (so Browser sees the new session)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. Check Auth Status (Securely)
  // getUser() is safer than getSession() in middleware
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();

  // --- Redirect Logic ---

  // A. If Logged In -> Block Access to Auth Pages (Login/Signup)
  // But allow /auth/select-role (it's needed for OAuth role selection)
  if (user) {
    if (url.pathname.startsWith("/auth") && !url.pathname.startsWith("/auth/select-role")) {
      // Check role from user metadata to redirect correctly
      const role = user.user_metadata?.role;
      if (role === "recruiter") {
        url.pathname = "/recruiter/dashboard";
      } else {
        url.pathname = "/dashboard";
      }
      return NextResponse.redirect(url);
    }
  }

  // B. If Not Logged In → Block Access to Protected Pages
  if (!user) {
    // Protect /dashboard, /rewrite, /recruiter, /admin, and /auth/select-role
    if (
      url.pathname.startsWith("/dashboard") || 
      url.pathname.startsWith("/rewrite") ||
      url.pathname.startsWith("/recruiter") ||
      url.pathname.startsWith("/admin") ||
      url.pathname.startsWith("/auth/select-role")
    ) {
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }
  }

  // C. Admin Route Protection — only role === "admin" can access /admin/*
  if (user && url.pathname.startsWith("/admin")) {
    const role = user.user_metadata?.role;
    if (role !== "admin") {
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*", 
    "/rewrite/:path*", 
    "/recruiter/:path*",
    "/admin/:path*",
    "/auth/:path*"
  ],
};