import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import RecruiterShell from "@/components/RecruiterShell";

export default async function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Setup Supabase Server Client
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
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components can't set cookies — safe to ignore
          }
        },
      },
    }
  );

  // 2. Verify Session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 3. Render the Recruiter Shell
  return (
    <RecruiterShell user={user}>
      {children}
    </RecruiterShell>
  );
}
