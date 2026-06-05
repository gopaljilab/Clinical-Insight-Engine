import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Github,
  HeartPulse,
  LineChart,
  Linkedin,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Stethoscope,
  Workflow,
  Plus,
  Check,
  Sparkles,
  ClipboardList,
  Target,
} from "lucide-react";
import { AuthFlowModal, type AuthMode } from "@/components/AuthFlowModal";
import ThemeToggle from "@/components/ThemeToggle";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
  { href: "#validation", label: "Validation" },
  { href: "#faq", label: "FAQ" },
  { href: "#pricing", label: "Pricing" },
];

const trustBadges = [
  { icon: ShieldCheck, label: "HIPAA Compliant" },
  { icon: LockKeyhole, label: "GDPR Secure" },
  { icon: CheckCircle2, label: "SOC2 Type II" },
];

const featureCards = [
  {
    icon: Activity,
    title: "Instant Risk Modeling",
    description:
      "Process BMI, HbA1c, blood pressure, and vitals in seconds using AI-powered predictive analytics.",
  },
  {
    icon: LineChart,
    title: "Longitudinal Patient History",
    description:
      "Track patient risk progression over time with dynamic visual trend analysis and historical insights.",
  },
  {
    icon: Workflow,
    title: "Frictionless Clinical Workflow",
    description:
      "Designed alongside cardiologists to integrate seamlessly into a 2-minute consultation workflow.",
  },
];

const heroBadges = ["Clinical AI", "Early Risk Detection", "Real-Time Analytics"];

const footerLinks = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
  { href: "mailto:support@clinicalinsight.org", label: "Contact" },
];

const socialLinks = [
  { href: "https://www.linkedin.com", icon: Linkedin, label: "LinkedIn" },
  { href: "https://github.com/gopaljilab/Clinical-Insight-Engine", icon: Github, label: "GitHub" },
  { href: "mailto:support@clinicalinsight.org", icon: Mail, label: "Email" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB] text-white shadow-lg shadow-blue-600/20">
        <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        <HeartPulse className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-white dark:bg-slate-950 p-0.5 text-[#2563EB]" aria-hidden="true" />
      </div>
      <div className="leading-tight">
        <p className="text-lg font-black tracking-tight text-[#1E293B] dark:text-slate-100">Clinical Insight</p>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Clinical AI</p>
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto max-w-xl">
      <div className="absolute -left-6 top-12 hidden rounded-2xl bg-white/90 dark:bg-slate-900/90 p-4 shadow-xl shadow-slate-900/10 dark:shadow-slate-950/30 ring-1 ring-slate-200/70 dark:ring-slate-800 backdrop-blur md:block">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Risk drop</p>
        <p className="mt-1 text-2xl font-black text-emerald-500">-18%</p>
      </div>
      <div className="absolute -right-4 bottom-16 hidden rounded-2xl bg-white/90 dark:bg-slate-900/90 p-4 shadow-xl shadow-slate-900/10 dark:shadow-slate-950/30 ring-1 ring-slate-200/70 dark:ring-slate-800 backdrop-blur sm:block">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Model speed</p>
        <p className="mt-1 text-2xl font-black text-[#2563EB]">4.2s</p>
      </div>

      <div className="rounded-[2rem] bg-white/80 dark:bg-slate-900/80 p-3 shadow-2xl shadow-blue-950/10 ring-1 ring-white/80 dark:ring-slate-800 backdrop-blur">
        <div className="overflow-hidden rounded-[1.5rem] bg-slate-950 text-white">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-white">Patient Risk Console</p>
              <p className="text-xs text-slate-400">Preventive cardiometabolic assessment</p>
            </div>
            <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300">
              Live
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl bg-white dark:bg-slate-950 p-4 text-slate-900 dark:text-slate-100">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Risk Score</span>
                <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                  Moderate
                </span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-black tracking-tight text-[#1E293B] dark:text-slate-100">42</span>
                <span className="pb-2 text-sm font-bold text-slate-500 dark:text-slate-400">/100</span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full w-[42%] rounded-full bg-[#2563EB]" />
              </div>
              <div className="mt-5 space-y-3">
                {["HbA1c elevation", "BMI trend", "Blood pressure"].map((factor, index) => (
                  <div key={factor} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-600 dark:text-slate-400">{factor}</span>
                    <span className="font-bold text-[#2563EB] dark:text-blue-400">+{index + 7}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 dark:bg-slate-950/50 border border-transparent dark:border-slate-850/50 p-4">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">6 Month Trend</p>
                  <p className="text-xs text-slate-400">Dynamic patient history</p>
                </div>
                <LineChart className="h-5 w-5 text-blue-300" aria-hidden="true" />
              </div>
              <div className="flex h-36 items-end gap-3">
                {[46, 58, 52, 64, 48, 42].map((height, index) => (
                  <div key={height + index} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-[#2563EB] to-cyan-300"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">M{index + 1}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-emerald-400/10 p-3 text-sm text-emerald-200">
                Earlier intervention window detected for metabolic markers.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/60 to-white text-slate-600 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-300 transition-colors duration-300">
      <header className="sticky top-0 z-50 border-b border-white/70 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl transition-colors duration-300">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <a href="#" aria-label="Clinical Insight home">
            <BrandMark />
          </a>

          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-bold text-slate-600 dark:text-slate-400 transition-all duration-200 hover:text-[#2563EB] dark:hover:text-blue-400"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              className="hidden rounded-2xl px-4 py-3 text-sm font-black text-slate-600 dark:text-slate-400 transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-[#2563EB] dark:hover:text-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:inline-flex"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("register")}
              className="hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-black text-[#1E293B] dark:text-slate-200 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2563EB] hover:text-[#2563EB] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100 md:inline-flex"
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              className="inline-flex items-center justify-center rounded-2xl bg-[#2563EB] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/25 focus:outline-none focus:ring-4 focus:ring-blue-200"
            >
              Go to App
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden px-5 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="absolute left-1/2 top-12 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-300/20 blur-3xl" aria-hidden="true" />
          <div className="absolute right-8 top-44 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" aria-hidden="true" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.04fr_0.96fr]">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <div className="mb-7 flex flex-wrap gap-3">
                {heroBadges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full bg-white/80 dark:bg-slate-900/80 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#2563EB] shadow-sm ring-1 ring-blue-100 dark:ring-blue-950/50"
                  >
                    {badge}
                  </span>
                ))}
              </div>

              <h1 className="max-w-4xl text-4xl font-black leading-[1.04] tracking-tight text-[#1E293B] dark:text-slate-100 sm:text-5xl lg:text-6xl">
                AI-Driven Preventive Diabetes Risk Assessment
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-400 sm:text-xl">
                Empower your clinic with instant, data-backed patient risk models to detect diabetes before symptoms appear.
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <a
                  href="mailto:support@clinicalinsight.org"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-7 py-4 text-base font-black text-white shadow-xl shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-blue-700 hover:shadow-2xl hover:shadow-blue-600/30 focus:outline-none focus:ring-4 focus:ring-blue-200"
                >
                  Request a Demo
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </a>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-7 py-4 text-base font-black text-[#1E293B] dark:text-slate-200 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2563EB] hover:text-[#2563EB] hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  See Features
                </a>
              </div>

              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className="mt-5 text-sm font-black text-[#2563EB] transition-all duration-200 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                Already have access? Login to your clinical dashboard
              </button>

              <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
                {[
                  ["2 min", "clinical workflow"],
                  ["24/7", "risk insights"],
                  ["99.9%", "uptime target"],
                ].map(([value, label]) => (
                  <div key={value} className="rounded-2xl bg-white/75 dark:bg-slate-900/75 p-4 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-800 backdrop-blur">
                    <p className="text-2xl font-black text-[#1E293B] dark:text-slate-100">{value}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            >
              <DashboardPreview />
            </motion.div>
          </div>
        </section>

        <section id="security" className="bg-slate-100/80 dark:bg-slate-900/20 px-5 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 rounded-2xl bg-white/75 dark:bg-slate-900/75 px-5 py-5 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-800 backdrop-blur lg:flex-row">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {trustBadges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <div key={badge.label} className="flex items-center gap-2 rounded-full bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 px-4 py-2 text-sm font-bold text-[#1E293B] dark:text-slate-200">
                    <Icon className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                    {badge.label}
                  </div>
                );
              })}
            </div>
            <p className="text-center text-sm font-semibold text-slate-500 dark:text-slate-400 lg:text-right">
              Built exclusively for clinical decision support.
            </p>
          </div>
        </section>

        <section id="features" className="px-5 py-20 sm:px-6 lg:px-8 border-b border-slate-100 dark:border-slate-800">
          <div className="mx-auto max-w-7xl">
            <motion.div
              className="mx-auto max-w-3xl text-center"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2563EB]">Built for preventive care teams</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-[#1E293B] dark:text-slate-100 sm:text-4xl">
                Risk assessment that fits the pace of modern clinics
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-400">
                Clinical Insight turns routine patient inputs into clear, explainable guidance for clinicians and patient-facing conversations.
              </p>
            </motion.div>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {featureCards.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.article
                    key={feature.title}
                    className="group rounded-2xl bg-white dark:bg-slate-900/40 border border-transparent dark:border-slate-850/50 p-8 shadow-sm shadow-slate-900/5 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10"
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.35, delay: index * 0.08 }}
                  >
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] transition-all duration-200 group-hover:scale-105 group-hover:bg-[#2563EB] group-hover:text-white">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="text-xl font-black text-[#1E293B] dark:text-slate-100">{feature.title}</h3>
                    <p className="mt-4 leading-7 text-slate-600 dark:text-slate-400">{feature.description}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 1: How It Integrates Workflow */}
        <section id="workflow" className="px-5 py-20 sm:px-6 lg:px-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">
          <div className="mx-auto max-w-7xl">
            <motion.div
              className="mx-auto max-w-3xl text-center"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2563EB]">Clinical Protocol</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-[#1E293B] dark:text-slate-100 sm:text-4xl">
                How It Integrates Workflow
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-400">
                A seamless, three-step clinical protocol designed to fit into a standard 2-minute patient consultation.
              </p>
            </motion.div>

            <div className="mt-14 grid gap-6 md:grid-cols-3 relative">
              {[
                {
                  step: "01",
                  title: "Swift Intake",
                  icon: ClipboardList,
                  description: "Input patient vitals—BMI, HbA1c, and blood pressure—directly into the intake module in less than 30 seconds."
                },
                {
                  step: "02",
                  title: "AI Risk Generation",
                  icon: Sparkles,
                  description: "The engine instantly processes biochemical and physiological markers to generate a precise cardiometabolic risk projection."
                },
                {
                  step: "03",
                  title: "Co-Created Smart Goals",
                  icon: Target,
                  description: "Generate and review collaborative target plans with the patient during the consult to improve long-term engagement and outcomes."
                }
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.article
                    key={item.title}
                    className="relative group rounded-2xl bg-slate-900/90 dark:bg-slate-900/40 border border-slate-800 p-6 shadow-xl backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 overflow-hidden"
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.35, delay: index * 0.08 }}
                  >
                    {/* Background decoration */}
                    <div className="absolute -bottom-6 -right-2 text-7xl font-black text-slate-800/10 dark:text-slate-800/25 select-none transition-transform duration-300 group-hover:scale-110">
                      {item.step}
                    </div>

                    <div className="flex items-center justify-between mb-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-[#2563EB] dark:text-blue-400 border border-blue-500/20 transition-all duration-200 group-hover:scale-105 group-hover:bg-[#2563EB] group-hover:text-white">
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </div>
                      
                      {index < 2 && (
                        <div className="hidden md:flex items-center gap-1 text-xs font-bold text-slate-500 uppercase tracking-widest">
                          <span>Next</span>
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-black text-white">{item.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.description}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 2: Clinical Validation Trust Panel */}
        <section id="validation" className="px-5 py-20 sm:px-6 lg:px-8 border-b border-slate-100 dark:border-slate-800">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              {/* Left Column: Mock Clinical Dashboard Card with SVG Chart */}
              <motion.div
                className="bg-slate-900/90 dark:bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-sm text-white"
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-5">
                  <div>
                    <h3 className="text-base font-black text-white">6-Month Risk Optimization Trend</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Efficacy validation cohort (n=1,240 patients)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                      Active Study
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Avg. HbA1c Reduction</p>
                    <p className="mt-1 text-xl font-black text-emerald-400">-1.4%</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">High-Risk Cohort Size</p>
                    <p className="mt-1 text-xl font-black text-emerald-400">-38%</p>
                  </div>
                </div>

                {/* SVG Chart */}
                <div className="relative w-full overflow-hidden">
                  <svg className="w-full h-auto" viewBox="0 0 500 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    <line x1="40" y1="30" x2="480" y2="30" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                    <line x1="40" y1="75" x2="480" y2="75" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                    <line x1="40" y1="120" x2="480" y2="120" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                    <line x1="40" y1="165" x2="480" y2="165" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                    <line x1="40" y1="210" x2="480" y2="210" stroke="#334155" strokeWidth="1" opacity="0.2" />

                    {/* Standard Care Cohort (Control) - Muted Line */}
                    <path
                      d="M 60 70 C 140 75, 220 85, 300 90 C 380 93, 420 94, 460 95"
                      stroke="#64748B"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      opacity="0.6"
                    />
                    <text x="320" y="85" fill="#64748B" fontSize="9" fontWeight="bold">Standard Care (Control)</text>

                    {/* Optimization Trend Line Area Fill */}
                    <path
                      d="M 60 70 C 140 95, 220 135, 300 150 C 380 162, 420 170, 460 175 L 460 210 L 60 210 Z"
                      fill="url(#chartGradient)"
                    />

                    {/* Optimization Trend Line */}
                    <path
                      d="M 60 70 C 140 95, 220 135, 300 150 C 380 162, 420 170, 460 175"
                      stroke="#3B82F6"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <text x="320" y="145" fill="#3B82F6" fontSize="9" fontWeight="bold">Optimization Cohort</text>

                    {/* Data Points - Optimization Trend */}
                    <circle cx="60" cy="70" r="4.5" fill="#3B82F6" stroke="#0F172A" strokeWidth="1.5" />
                    <circle cx="140" cy="95" r="4.5" fill="#3B82F6" stroke="#0F172A" strokeWidth="1.5" />
                    <circle cx="220" cy="135" r="4.5" fill="#3B82F6" stroke="#0F172A" strokeWidth="1.5" />
                    <circle cx="300" cy="150" r="4.5" fill="#3B82F6" stroke="#0F172A" strokeWidth="1.5" />
                    <circle cx="380" cy="162" r="4.5" fill="#3B82F6" stroke="#0F172A" strokeWidth="1.5" />
                    <circle cx="460" cy="175" r="4.5" fill="#10B981" stroke="#0F172A" strokeWidth="1.5" />

                    {/* Y-Axis Labels */}
                    <text x="15" y="34" fill="#64748B" fontSize="9" fontWeight="bold">8.5%</text>
                    <text x="15" y="79" fill="#64748B" fontSize="9" fontWeight="bold">8.0%</text>
                    <text x="15" y="124" fill="#64748B" fontSize="9" fontWeight="bold">7.5%</text>
                    <text x="15" y="169" fill="#64748B" fontSize="9" fontWeight="bold">7.0%</text>
                    <text x="15" y="214" fill="#64748B" fontSize="9" fontWeight="bold">6.5%</text>

                    {/* X-Axis Labels */}
                    <text x="60" y="232" fill="#64748B" fontSize="9" fontWeight="bold" textAnchor="middle">Baseline</text>
                    <text x="140" y="232" fill="#64748B" fontSize="9" fontWeight="bold" textAnchor="middle">Month 1</text>
                    <text x="220" y="232" fill="#64748B" fontSize="9" fontWeight="bold" textAnchor="middle">Month 2</text>
                    <text x="300" y="232" fill="#64748B" fontSize="9" fontWeight="bold" textAnchor="middle">Month 3</text>
                    <text x="380" y="232" fill="#64748B" fontSize="9" fontWeight="bold" textAnchor="middle">Month 4</text>
                    <text x="460" y="232" fill="#64748B" fontSize="9" fontWeight="bold" textAnchor="middle">Month 6</text>
                  </svg>
                </div>
              </motion.div>

              {/* Right Column: Trust Content */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2563EB]">Trust & Security</p>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-[#1E293B] dark:text-slate-100 sm:text-4xl">
                  Clinical Validation & Trusted AI
                </h2>
                
                <p className="mt-6 text-base leading-7 text-slate-600 dark:text-slate-400">
                  Our predictive models translate complex, multi-factor biochemical and physiological data into fully explainable risk profiles. Built for clinical teams who require transparent, evidence-based guidance.
                </p>

                <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-400">
                  Clinical Insight operates as a pure decision support tool. It highlights early intervention opportunities without overriding your team's ultimate diagnosis or treatment choices.
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    {
                      title: "Explainable AI (XAI)",
                      desc: "Understand exactly which parameters—such as HbA1c, blood pressure, and BMI—are driving a patient's risk category."
                    },
                    {
                      title: "Transparent Clinical Support",
                      desc: "Access verified clinical metrics, guidelines, and comparative cohorts with absolute clarity."
                    },
                    {
                      title: "Cardiometabolic Health Focus",
                      desc: "Analyze metabolic and cardiovascular markers side-by-side to target the root causes of chronic disease."
                    },
                    {
                      title: "Provider Oversight First",
                      desc: "Engineered specifically to support professional clinical interpretation, not replace it."
                    }
                  ].map((bullet) => (
                    <div key={bullet.title} className="flex gap-4">
                      <div className="mt-1 flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-[#2563EB] dark:text-blue-400 border border-blue-500/20">
                        <Check className="h-3 w-3" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-[#1E293B] dark:text-slate-100">{bullet.title}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{bullet.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Section 3: FAQ Accordion */}
        <section id="faq" className="px-5 py-20 sm:px-6 lg:px-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">
          <div className="mx-auto max-w-4xl">
            <motion.div
              className="text-center mb-14"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2563EB]">FAQ</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-[#1E293B] dark:text-slate-100 sm:text-4xl">
                Frequently Asked Questions
              </h2>
              <p className="mt-4 text-base text-slate-600 dark:text-slate-400">
                Quick answers regarding data security, exports, and clinical logic.
              </p>
            </motion.div>

            <div className="space-y-4">
              {[
                {
                  q: "Is data encrypted?",
                  a: "Yes. All patient health information (PHI) is encrypted both in transit (TLS 1.3) and at rest (AES-256). Our platform is fully HIPAA and SOC2 compliant, ensuring the highest standards of data security."
                },
                {
                  q: "Can I export reports as PDFs?",
                  a: "Absolutely. With a single click, clinicians can export comprehensive risk summaries, patient smart goals, and longitudinal trend reports as clean, professional PDFs for EHR integration or patient sharing."
                },
                {
                  q: "How does the engine calculate risk?",
                  a: "The risk modeling engine analyzes key clinical markers including HbA1c, BMI, blood pressure, and age using predictive algorithms validated against peer-reviewed cardiometabolic datasets. It highlights the primary factors driving the risk score to assist in clinical decision-making."
                }
              ].map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <motion.div
                    key={index}
                    className="bg-slate-900/90 dark:bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-lg backdrop-blur-sm"
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.35, delay: index * 0.05 }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(index)}
                      className="w-full flex items-center justify-between px-6 py-5 text-left text-white font-bold transition-colors hover:text-blue-400 focus:outline-none focus:text-blue-400 focus:ring-2 focus:ring-blue-500/40"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${index}`}
                    >
                      <span className="text-base sm:text-lg">{faq.q}</span>
                      <span className="ml-4 flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-slate-800/80 border border-slate-700/50 transition-colors group-hover:border-blue-500">
                        <Plus className={`h-4 w-4 text-blue-400 transform transition-transform duration-350 ${isOpen ? 'rotate-45 text-slate-400' : ''}`} />
                      </span>
                    </button>
                    
                    <div
                      id={`faq-answer-${index}`}
                      role="region"
                      className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                    >
                      <div className="overflow-hidden">
                        <div className="px-6 pb-6 text-sm sm:text-base text-slate-300 border-t border-slate-800/50 pt-4 leading-relaxed">
                          {faq.a}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-5 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-8 rounded-[2rem] bg-[#1E293B] p-8 text-white shadow-2xl shadow-slate-900/15 md:grid-cols-[1fr_auto] md:p-10">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-blue-100">
                <Stethoscope className="h-4 w-4" aria-hidden="true" />
                Clinic-ready rollout
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Bring preventive risk intelligence into every consultation.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Flexible demo plans for clinics, hospitals, and digital health teams evaluating AI-assisted cardiometabolic screening.
              </p>
            </div>
            <a
              href="mailto:support@clinicalinsight.org"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-base font-black text-[#1E293B] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-white/30"
            >
              Contact Sales
              <Mail className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-5 py-10 sm:px-6 lg:px-8 transition-colors duration-300">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <BrandMark />
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
              Copyright 2026 Clinical Insight. Built for clinical decision support, not diagnosis.
            </p>
          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {footerLinks.map((link) => (
              <a key={link.label} href={link.href} className="text-sm font-bold text-slate-600 dark:text-slate-400 transition-all duration-200 hover:text-[#2563EB] dark:hover:text-blue-400">
                {link.label}
              </a>
            ))}
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    target={social.href.startsWith("https://") ? "_blank" : undefined}
                    rel={social.href.startsWith("https://") ? "noreferrer" : undefined}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#2563EB] dark:hover:bg-blue-600 hover:text-white dark:hover:text-white"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </footer>

      <AuthFlowModal
        initialMode={authMode ?? "login"}
        isOpen={authMode !== null}
        onClose={() => setAuthMode(null)}
      />
    </div>
  );
}
