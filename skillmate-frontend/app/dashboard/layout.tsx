import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import DashboardShell from "@/components/DashboardShell"; // Adjust this import based on where you created the file

export default async function DashboardLayout({
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

  // 2. Verify Session (getUser is more secure than getSession — validates with auth server)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Session tokens are handled client-side by useAuth hook

  // 3. Render the UI Shell with User Data
  return (
    <DashboardShell user={user}>
      {children}
    </DashboardShell>
  );
}