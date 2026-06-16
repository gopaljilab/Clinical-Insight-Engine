import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";
import { useEffect } from "react";

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = "Privacy Policy | Clinical Insight Engine";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/60 to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 px-5 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB] text-white shadow-lg shadow-blue-600/20">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-black tracking-tight text-[#1E293B] dark:text-gray-100">Clinical Insight</p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Clinical AI</p>
          </div>
        </div>

        <h1 className="text-4xl font-black tracking-tight text-[#1E293B] dark:text-gray-100">Privacy Policy</h1>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Last updated: 2026</p>

        <div className="mt-10 space-y-8 text-base leading-7 text-slate-600 dark:text-slate-400">
          <section>
            <h2 className="text-xl font-black text-[#1E293B] dark:text-gray-100">1. Overview</h2>
            <p className="mt-3">
              Clinical Insight is a clinical decision support demo tool. This privacy policy describes how data entered into the application is handled during a session.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#1E293B] dark:text-gray-100">2. Data Collection</h2>
            <p className="mt-3">
              Clinical Insight collects clinical inputs (age, BMI, HbA1c, blood glucose, smoking history, and related vitals) solely to generate risk assessments. No data is shared with third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#1E293B] dark:text-gray-100">3. Demo Environment</h2>
            <p className="mt-3">
              This application is a demonstration environment. It is not intended for use with real patient data and does not meet HIPAA or GDPR compliance requirements in its current form.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#1E293B] dark:text-gray-100">4. Contact</h2>
            <p className="mt-3">
              For privacy-related enquiries, contact us at{" "}
              <a href="mailto:support@clinicalinsight.org" className="font-bold text-[#2563EB] hover:text-blue-700 dark:hover:text-blue-400">
                support@clinicalinsight.org
              </a>.
            </p>
          </section>
        </div>

        <Link
          href="/"
          className="mt-12 inline-flex items-center justify-center rounded-2xl bg-[#2563EB] px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-700"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
