import Link from "next/link";
import { Sparkles, ArrowLeft, Shield, Database, Eye, Trash2, Mail, Globe, Lock } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Skillmate AI",
  description: "Learn how Skillmate AI collects, uses, and protects your personal data.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "June 11, 2026";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            Skillmate AI
          </Link>
          <Link href="/" className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900/30">
              <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Privacy Policy</h1>
              <p className="text-sm text-slate-500">Last updated: {lastUpdated}</p>
            </div>
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed">
            At Skillmate AI, your privacy is important to us. This Privacy Policy explains how we collect, use, store, and protect your personal data when you use our platform.
          </p>
        </div>

        <div className="space-y-12 text-slate-700 dark:text-slate-300">
          {/* Section 1 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-5 w-5 text-indigo-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">1. Information We Collect</h2>
            </div>
            <div className="space-y-3 ml-7">
              <p><strong>Account Information:</strong> When you sign up, we collect your email address, name, and authentication credentials. If you sign in via Google or GitHub, we receive your profile information from those providers.</p>
              <p><strong>Resume Data:</strong> When you upload a resume for analysis, we temporarily store the extracted text to provide our AI services (ATS scanning, rewriting, etc.).</p>
              <p><strong>Job Descriptions:</strong> Job descriptions you paste or upload are processed to provide matching and analysis services.</p>
              <p><strong>Usage Data:</strong> We collect anonymized analytics about how you use the platform, including features accessed, session duration, and error logs.</p>
              <p><strong>Payment Data:</strong> Payments are processed by Stripe. We do not store credit card numbers. We receive transaction confirmations and your purchase history.</p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Eye className="h-5 w-5 text-indigo-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">2. How We Use Your Data</h2>
            </div>
            <ul className="list-disc ml-12 space-y-2">
              <li>Provide, personalize, and improve our AI-powered career services</li>
              <li>Process your resume analysis, ATS scoring, and rewriting requests</li>
              <li>Manage your account, credits, and subscriptions</li>
              <li>Send transactional emails (receipts, password resets, important updates)</li>
              <li>Detect and prevent fraud, abuse, and security threats</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-3 ml-7">We <strong>never</strong> sell your personal data to third parties or use your resume content for training AI models.</p>
          </section>

          {/* Section 3 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-indigo-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">3. Third-Party Services</h2>
            </div>
            <div className="ml-7 space-y-3">
              <p>We use the following third-party services that may process your data:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li><strong>Supabase</strong> — Authentication and user management</li>
                <li><strong>Anthropic (Claude AI)</strong> — AI text processing (resume and content analysis)</li>
                <li><strong>Groq</strong> — Fallback AI provider for text processing</li>
                <li><strong>Stripe</strong> — Payment processing</li>
              </ul>
              <p>Each provider has their own privacy policy. Your resume text is sent to AI providers for processing but is not stored by them beyond the request lifecycle.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-indigo-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">4. Data Security</h2>
            </div>
            <div className="ml-7 space-y-3">
              <p>We implement industry-standard security measures including:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li>HTTPS encryption for all data in transit</li>
                <li>JWT-based authentication with secure token handling</li>
                <li>Input validation and sanitization to prevent injection attacks</li>
                <li>Rate limiting to prevent abuse</li>
                <li>Regular security audits and dependency updates</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Trash2 className="h-5 w-5 text-indigo-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">5. Data Retention & Deletion</h2>
            </div>
            <div className="ml-7 space-y-3">
              <p><strong>Uploaded Files:</strong> Resume files are processed and text is extracted. Original files are deleted after 30 days of inactivity.</p>
              <p><strong>Analysis History:</strong> Your analysis results are retained for 90 days unless you delete them sooner.</p>
              <p><strong>Account Data:</strong> Retained for the lifetime of your account. Inactive accounts (no login for 2 years) will be notified before deletion.</p>
              <p><strong>Data Deletion Request:</strong> You may request complete deletion of your data at any time by contacting us at <a href="mailto:privacy@skillmate.ai" className="text-indigo-600 dark:text-indigo-400 hover:underline">privacy@skillmate.ai</a>. We will process your request within 30 days.</p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5 text-indigo-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">6. Your Rights</h2>
            </div>
            <div className="ml-7 space-y-3">
              <p>Depending on your location, you may have the following rights:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li><strong>Access:</strong> Request a copy of all personal data we hold about you</li>
                <li><strong>Rectification:</strong> Correct inaccurate personal data</li>
                <li><strong>Erasure:</strong> Request deletion of your personal data</li>
                <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
                <li><strong>Objection:</strong> Object to processing of your data for specific purposes</li>
              </ul>
              <p>To exercise any of these rights, email <a href="mailto:privacy@skillmate.ai" className="text-indigo-600 dark:text-indigo-400 hover:underline">privacy@skillmate.ai</a>.</p>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">7. Cookies</h2>
            <div className="ml-0 space-y-3">
              <p>We use essential cookies for authentication and session management. We do not use tracking or advertising cookies. Third-party authentication providers (Google, GitHub) may set their own cookies during the sign-in flow.</p>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">8. Children&apos;s Privacy</h2>
            <p>Skillmate AI is not intended for users under 13 years of age. We do not knowingly collect data from children under 13. If you believe a child has provided us with personal data, contact us and we will promptly delete it.</p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy periodically. We will notify you of significant changes via email or an in-app notification. Continued use of the platform after changes constitutes acceptance of the updated policy.</p>
          </section>

          {/* Section 10 */}
          <section className="border-t border-slate-200 dark:border-slate-800 pt-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">10. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or your data, contact us at:</p>
            <div className="mt-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <p className="font-semibold text-slate-900 dark:text-white">Skillmate AI</p>
              <p>Email: <a href="mailto:privacy@skillmate.ai" className="text-indigo-600 dark:text-indigo-400 hover:underline">privacy@skillmate.ai</a></p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
