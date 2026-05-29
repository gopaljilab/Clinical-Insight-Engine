import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/60 to-white px-5 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB] text-white shadow-lg shadow-blue-600/20">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-black tracking-tight text-[#1E293B]">CardioGuard</p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Clinical AI</p>
          </div>
        </div>

        <h1 className="text-4xl font-black tracking-tight text-[#1E293B]">Privacy Policy</h1>
        <p className="mt-4 text-sm text-slate-500">Last updated: 2026</p>

        <div className="mt-10 space-y-8 text-base leading-7 text-slate-600">
          <section>
            <h2 className="text-xl font-black text-[#1E293B]">1. Overview</h2>
            <p className="mt-3">
              CardioGuard is a clinical decision support demo tool. This privacy policy describes how data entered into the application is handled during a session.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#1E293B]">2. Data Collection</h2>
            <p className="mt-3">
              CardioGuard collects clinical inputs (age, BMI, HbA1c, blood glucose, smoking history, and related vitals) solely to generate risk assessments. No data is shared with third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#1E293B]">3. Demo Environment</h2>
            <p className="mt-3">
              This application is a demonstration environment. It is not intended for use with real patient data and does not meet HIPAA or GDPR compliance requirements in its current form.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#1E293B]">4. Contact</h2>
            <p className="mt-3">
              For privacy-related enquiries, contact us at{" "}
              <a href="mailto:hello@cardioguard.ai" className="font-bold text-[#2563EB] hover:text-blue-700">
                hello@cardioguard.ai
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
