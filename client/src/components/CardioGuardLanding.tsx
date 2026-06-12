import { useLocation } from "wouter";
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
  PlayCircle,
  ShieldCheck,
  Stethoscope,
  Workflow,
} from "lucide-react";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#security", label: "Security" },
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
  { href: "#security", label: "Privacy Policy" },
  { href: "#security", label: "Terms" },
  { href: "mailto:hello@cardioguard.ai", label: "Contact" },
];

const socialLinks = [
  { href: "https://www.linkedin.com", icon: Linkedin, label: "LinkedIn" },
  { href: "https://github.com/gopaljilab/Clinical-Insight-Engine", icon: Github, label: "GitHub" },
  { href: "mailto:hello@cardioguard.ai", icon: Mail, label: "Email" },
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
        <HeartPulse className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-white p-0.5 text-[#2563EB]" aria-hidden="true" />
      </div>
      <div className="leading-tight">
        <p className="text-lg font-black tracking-tight text-[#1E293B]">CardioGuard</p>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Clinical AI</p>
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto max-w-xl">
      <div className="absolute -left-6 top-12 hidden rounded-2xl bg-white/90 p-4 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200/70 backdrop-blur md:block">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Risk drop</p>
        <p className="mt-1 text-2xl font-black text-emerald-500">-18%</p>
      </div>
      <div className="absolute -right-4 bottom-16 hidden rounded-2xl bg-white/90 p-4 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200/70 backdrop-blur sm:block">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Model speed</p>
        <p className="mt-1 text-2xl font-black text-[#2563EB]">4.2s</p>
      </div>

      <div className="rounded-[2rem] bg-white/80 p-3 shadow-2xl shadow-blue-950/10 ring-1 ring-white/80 backdrop-blur">
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
            <div className="rounded-2xl bg-white p-4 text-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">Risk Score</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                  Moderate
                </span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-black tracking-tight text-[#1E293B]">42</span>
                <span className="pb-2 text-sm font-bold text-slate-500">/100</span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[42%] rounded-full bg-[#2563EB]" />
              </div>
              <div className="mt-5 space-y-3">
                {["HbA1c elevation", "BMI trend", "Blood pressure"].map((factor, index) => (
                  <div key={factor} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-600">{factor}</span>
                    <span className="font-bold text-[#2563EB]">+{index + 7}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 p-4">
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
                    <span className="text-[10px] font-semibold text-slate-500">M{index + 1}</span>
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

export function CardioGuardLanding() {
  const [, setLocation] = useLocation();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/60 to-white text-slate-600">
      <header className="sticky top-0 z-50 border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <a href="#" aria-label="CardioGuard home">
            <BrandMark />
          </a>

          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-bold text-slate-600 transition-all duration-200 hover:text-[#2563EB]"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocation("/login")}
              className="hidden rounded-2xl px-4 py-3 text-sm font-black text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-[#2563EB] focus:outline-none focus:ring-4 focus:ring-blue-100 sm:inline-flex"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setLocation("/login?mode=register")}
              className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#1E293B] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2563EB] hover:text-[#2563EB] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100 md:inline-flex"
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => setLocation("/login")}
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
                    className="rounded-full bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#2563EB] shadow-sm ring-1 ring-blue-100"
                  >
                    {badge}
                  </span>
                ))}
              </div>

              <h1 className="max-w-4xl text-4xl font-black leading-[1.04] tracking-tight text-[#1E293B] sm:text-5xl lg:text-6xl">
                AI-Driven Preventive Cardiology & Diabetes Risk Assessment
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                Empower your clinic with instant, data-backed patient risk models to detect cardiovascular disease and diabetes before symptoms appear.
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setLocation("/login?mode=register")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-7 py-4 text-base font-black text-white shadow-xl shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-blue-700 hover:shadow-2xl hover:shadow-blue-600/30 focus:outline-none focus:ring-4 focus:ring-blue-200"
                >
                  Request a Demo
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white/80 px-7 py-4 text-base font-black text-[#1E293B] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2563EB] hover:text-[#2563EB] hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <PlayCircle className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />
                  Watch Video
                </a>
              </div>

              <button
                type="button"
                onClick={() => setLocation("/login")}
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
                  <div key={value} className="rounded-2xl bg-white/75 p-4 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
                    <p className="text-2xl font-black text-[#1E293B]">{value}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
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

        <section id="security" className="bg-slate-100/80 px-5 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 rounded-2xl bg-white/75 px-5 py-5 shadow-sm ring-1 ring-slate-200/70 backdrop-blur lg:flex-row">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {trustBadges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <div key={badge.label} className="flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm font-bold text-[#1E293B]">
                    <Icon className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                    {badge.label}
                  </div>
                );
              })}
            </div>
            <p className="text-center text-sm font-semibold text-slate-500 lg:text-right">
              Built exclusively for clinical decision support.
            </p>
          </div>
        </section>

        <section id="features" className="px-5 py-20 sm:px-6 lg:px-8">
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
              <h2 className="mt-4 text-3xl font-black tracking-tight text-[#1E293B] sm:text-4xl">
                Risk assessment that fits the pace of modern clinics
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                CardioGuard turns routine patient inputs into clear, explainable guidance for clinicians and patient-facing conversations.
              </p>
            </motion.div>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {featureCards.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.article
                    key={feature.title}
                    className="group rounded-2xl bg-white p-8 shadow-sm shadow-slate-900/5 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10"
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.35, delay: index * 0.08 }}
                  >
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB] transition-all duration-200 group-hover:scale-105 group-hover:bg-[#2563EB] group-hover:text-white">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="text-xl font-black text-[#1E293B]">{feature.title}</h3>
                    <p className="mt-4 leading-7 text-slate-600">{feature.description}</p>
                  </motion.article>
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
              href="mailto:hello@cardioguard.ai"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-base font-black text-[#1E293B] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-white/30"
            >
              Contact Sales
              <Mail className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <BrandMark />
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-500">
              Copyright 2026 CardioGuard. Built for clinical decision support, not diagnosis.
            </p>
          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {footerLinks.map((link) => (
              <a key={link.label} href={link.href} className="text-sm font-bold text-slate-600 transition-all duration-200 hover:text-[#2563EB]">
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
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#2563EB] hover:text-white"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </footer>

      
    </div>
  );
}
