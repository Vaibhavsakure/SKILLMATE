import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";

// 1. Optimize Font Loading
const inter = Inter({ subsets: ["latin"] });

// 3. SEO & Browser Metadata
export const metadata: Metadata = {
  title: "Skillmate AI | Career Intelligence Platform",
  description: "AI-powered resume builder, ATS scanner, and job match intelligence.",
  icons: {
    icon: "/favicon.ico",
  },
  metadataBase: new URL("https://skillmate.ai"),
  openGraph: {
    title: "Skillmate AI | Career Intelligence Platform",
    description: "Beat the ATS. Land the Interview. AI-powered career tools.",
    siteName: "Skillmate AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent dark mode flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('skillmate-theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 antialiased transition-colors duration-200`}>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}