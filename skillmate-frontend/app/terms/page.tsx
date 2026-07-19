import Link from "next/link";
import { Sparkles, ArrowLeft, FileText, Scale, AlertTriangle, CreditCard, Ban, RefreshCcw } from "lucide-react";

export const metadata = {
  title: "Terms of Service — Skillmate AI",
  description: "Terms and conditions for using the Skillmate AI career intelligence platform.",
};

export default function TermsOfServicePage() {
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-900/30">
              <Scale className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Terms of Service</h1>
              <p className="text-sm text-slate-500">Last updated: {lastUpdated}</p>
            </div>
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed">
            By using Skillmate AI, you agree to these Terms of Service. Please read them carefully before creating an account or using our services.
          </p>
        </div>

        <div className="space-y-12 text-slate-700 dark:text-slate-300">
          {/* Section 1 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-purple-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">1. Acceptance of Terms</h2>
            </div>
            <div className="ml-7 space-y-3">
              <p>By accessing or using Skillmate AI (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not use the Service.</p>
              <p>You must be at least 13 years old to use the Service. If you are under 18, you must have parental or guardian consent.</p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">2. Description of Service</h2>
            <div className="space-y-3">
              <p>Skillmate AI is an AI-powered career intelligence platform that provides:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Resume analysis and ATS compatibility scoring</li>
                <li>AI-powered resume rewriting and optimization</li>
                <li>Cover letter generation</li>
                <li>Interview preparation and simulation</li>
                <li>LinkedIn profile optimization</li>
                <li>Career roadmap and skill tree generation</li>
                <li>Job board and recruiter portal</li>
              </ul>
              <p>The Service uses artificial intelligence (AI) to generate content and analysis. AI-generated content should be reviewed by you before use and is provided as a starting point, not a guaranteed outcome.</p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">3. User Accounts</h2>
            <div className="space-y-3">
              <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Provide accurate and complete registration information</li>
                <li>Keep your password secure and do not share it</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>You may not create accounts for others without permission</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-purple-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">4. Credits, Payments & Refunds</h2>
            </div>
            <div className="ml-7 space-y-3">
              <p><strong>Credits:</strong> Some features require credits. Credits are non-transferable and expire 12 months after purchase unless otherwise stated.</p>
              <p><strong>Payments:</strong> All payments are processed securely via Stripe. Prices are displayed before purchase and may change with notice.</p>
              <p><strong>Subscriptions:</strong> Recruiter subscriptions are billed monthly. You can cancel at any time; access continues until the end of the billing period.</p>
              <p><strong>Refunds:</strong> We offer refunds within 7 days of purchase if you have not used the purchased credits. Contact <a href="mailto:support@skillmate.ai" className="text-indigo-600 dark:text-indigo-400 hover:underline">support@skillmate.ai</a> for refund requests.</p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Ban className="h-5 w-5 text-purple-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">5. Acceptable Use</h2>
            </div>
            <div className="ml-7 space-y-3">
              <p>You agree NOT to:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Use the Service for any illegal purpose</li>
                <li>Upload malicious files, malware, or harmful content</li>
                <li>Attempt to manipulate AI systems through prompt injection</li>
                <li>Scrape, crawl, or automate access to the Service without permission</li>
                <li>Share, resell, or redistribute AI-generated content commercially without attribution</li>
                <li>Impersonate others or misrepresent your identity</li>
                <li>Circumvent rate limits, security measures, or access controls</li>
                <li>Use the Service to generate misleading, fraudulent, or deceptive resume content</li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">6. Intellectual Property</h2>
            <div className="space-y-3">
              <p><strong>Your Content:</strong> You retain ownership of all content you upload (resumes, job descriptions, etc.). By uploading content, you grant us a limited, non-exclusive license to process it for providing the Service.</p>
              <p><strong>AI-Generated Content:</strong> Content generated by our AI (rewritten resumes, cover letters, etc.) is provided for your personal and professional use. You are free to use, modify, and distribute it as your own.</p>
              <p><strong>Our Platform:</strong> The Skillmate AI platform, brand, design, and proprietary algorithms are owned by Skillmate AI. You may not copy, modify, or reverse-engineer any part of the platform.</p>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-purple-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">7. Disclaimers & Limitations</h2>
            </div>
            <div className="ml-7 space-y-3">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm">
                <p className="font-semibold text-amber-800 dark:text-amber-400 mb-2">Important Disclaimer</p>
                <p className="text-amber-700 dark:text-amber-300">Skillmate AI provides AI-assisted career tools as a productivity aid. We do not guarantee job placement, interview success, or specific ATS scores with any employer. AI-generated content may contain inaccuracies and should always be reviewed before use.</p>
              </div>
              <p><strong>No Guarantee of Employment:</strong> The Service is a tool to help optimize your job application materials. We do not guarantee employment outcomes.</p>
              <p><strong>AI Limitations:</strong> AI-generated content may occasionally be inaccurate, irrelevant, or require editing. You are responsible for reviewing and verifying all output.</p>
              <p><strong>Service Availability:</strong> We strive for high availability but do not guarantee uninterrupted access. We may perform maintenance with reasonable notice.</p>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Skillmate AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising out of your use of the Service.</p>
            <p className="mt-3">Our total liability for any claim arising from or related to the Service shall not exceed the amount you paid to us in the 12 months preceding the claim.</p>
          </section>

          {/* Section 9 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <RefreshCcw className="h-5 w-5 text-purple-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">9. Account Termination</h2>
            </div>
            <div className="ml-7 space-y-3">
              <p>You may delete your account at any time through your account settings or by contacting us.</p>
              <p>We may suspend or terminate your account if you violate these Terms, with or without notice. Upon termination, your right to use the Service ceases immediately.</p>
              <p>We may delete inactive accounts (no login for 2 years) after sending a notification to your registered email.</p>
            </div>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">10. Dispute Resolution</h2>
            <p>Any disputes arising from these Terms or your use of the Service will be resolved through good-faith negotiation first. If unresolved, disputes will be settled through binding arbitration in accordance with the rules of the jurisdiction in which Skillmate AI operates.</p>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">11. Changes to Terms</h2>
            <p>We reserve the right to update these Terms at any time. We will notify you of material changes via email or an in-app notification at least 30 days before the changes take effect. Your continued use of the Service after changes constitutes acceptance.</p>
          </section>

          {/* Contact */}
          <section className="border-t border-slate-200 dark:border-slate-800 pt-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">12. Contact</h2>
            <p>For questions about these Terms, contact us at:</p>
            <div className="mt-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <p className="font-semibold text-slate-900 dark:text-white">Skillmate AI</p>
              <p>Email: <a href="mailto:legal@skillmate.ai" className="text-indigo-600 dark:text-indigo-400 hover:underline">legal@skillmate.ai</a></p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
