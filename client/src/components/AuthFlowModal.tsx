import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { ApiClient } from "@/lib/apiClient";
import { motion } from "framer-motion";
import {
  Activity,
  BadgeCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartPulse,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Stethoscope,
  Terminal,
  User,
  X,
} from "lucide-react";

import type { AuthMode } from "@/types/auth";
export type { AuthMode };

interface AuthFlowModalProps {
  initialMode: AuthMode;
  isOpen: boolean;
  onClose: () => void;
}

const metricCards = [
  { label: "Heart Rate", value: "72 bpm", icon: HeartPulse },
  { label: "HbA1c", value: "5.8%", icon: Activity },
  { label: "Risk Score", value: "18/100", icon: ShieldCheck },
  { label: "Blood Pressure", value: "118/76", icon: Stethoscope },
];

function AuthBrandPanel() {
  return (
    <aside className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-900 p-8 text-white lg:p-10">
      <div className="absolute -left-16 top-16 h-52 w-52 rounded-full bg-cyan-300/20 blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />

      <div className="relative flex h-full flex-col justify-between gap-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#2563EB] shadow-xl shadow-blue-950/20">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
              <HeartPulse className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-[#2563EB] p-0.5 text-white" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xl font-black tracking-tight">Clinical Insight</p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Secure Clinical AI</p>
            </div>
          </div>

          <div className="mt-12 max-w-md">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-100">Provider access</p>
            <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight lg:text-4xl">
              Protected workflows for preventive cardiometabolic care.
            </h2>
            <p className="mt-5 text-base leading-7 text-blue-100">
              Clinical Insight helps clinics identify high-risk diabetes patients before symptoms emerge.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {metricCards.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-lg shadow-blue-950/10 backdrop-blur">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-5 w-5 text-blue-100" aria-hidden="true" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">{metric.label}</p>
                <p className="mt-1 text-lg font-black text-white">{metric.value}</p>
              </div>
            );
          })}
        </div>

        <div className="relative rounded-2xl border border-white/15 bg-white/10 p-5 shadow-xl shadow-blue-950/10 backdrop-blur">
          <div className="mb-3 flex items-center gap-2 text-blue-100">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-[0.18em]">Clinical-grade security</span>
          </div>
          <p className="text-sm leading-6 text-white/90">
            Role-aware access simulation with two-step verification for confident clinical walkthroughs.
          </p>
        </div>
      </div>
    </aside>
  );
}

function SecurityNotice() {
  return (
    <div className="mt-8 rounded-2xl bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#2563EB]" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold text-[#1E293B]">Your session is protected with secure HTTP-only cookies and server-side authentication.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Session Auth", "HTTP-only Cookies", "Demo Environment"].map((badge) => (
              <span key={badge} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DevelopmentNotice() {
  if (!import.meta.env.DEV) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      <div className="flex items-start gap-2">
        <Terminal className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="font-semibold leading-5">
          Development Environment: Use local .env.local seeded clinician credentials to bypass or test dashboard integrations.
        </p>
      </div>
    </div>
  );
}

function TextInput({
  icon: Icon,
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  required = true,
  value,
  onChange,
}: {
  icon: typeof Mail;
  label: string;
  name: string;
  type?: string;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-[#1E293B]">{label}</span>
      <span className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus-within:border-[#2563EB] focus-within:ring-4 focus-within:ring-blue-100">
        <Icon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={onChange}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#1E293B] outline-none placeholder:text-slate-400"
        />
      </span>
    </label>
  );
}

function PasswordInput({
  label,
  name,
  autoComplete,
  value,
  onChange,
}: {
  label: string;
  name: string;
  autoComplete: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <label className="block">
      <span className="text-sm font-bold text-[#1E293B]">{label}</span>
      <span className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus-within:border-[#2563EB] focus-within:ring-4 focus-within:ring-blue-100">
        <KeyRound className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          name={name}
          type={showPassword ? "text" : "password"}
          placeholder="Enter password"
          autoComplete={autoComplete}
          required
          value={value}
          onChange={onChange}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#1E293B] outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          className="rounded-xl p-1.5 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-[#2563EB] focus:outline-none focus:ring-4 focus:ring-blue-100"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
}

function LoginForm({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onSwitch,
  onForgotPassword,
  isLoading,
  error,
}: {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSwitch: () => void;
  onForgotPassword?: () => void;
  isLoading?: boolean;
  error?: string | null;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <DevelopmentNotice />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <TextInput
        icon={Mail}
        label="Email Address"
        name="email"
        type="email"
        placeholder="clinician@clinic.com"
        autoComplete="email"
        value={email}
        onChange={(event) => onEmailChange(event.target.value)}
      />
      <PasswordInput
        label="Password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
      />

      <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-600">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]" />
          Remember Me
        </label>
        <button type="button" onClick={onForgotPassword} className="text-left font-bold text-[#2563EB] transition-all duration-200 hover:text-blue-700">
          Forgot Password
        </button>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-5 py-4 text-base font-black text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/25 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100"
      >
        {isLoading ? (
          <>
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Signing In...
          </>
        ) : (
          <>
            Sign In
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="text-center text-sm font-semibold text-slate-500">
        Don&apos;t have an account?{" "}
        <button type="button" onClick={onSwitch} className="font-black text-[#2563EB] transition-all duration-200 hover:text-blue-700">
          Register
        </button>
      </p>
    </form>
  );
}

function RegisterForm({
  onSubmit,
  onSwitch,
  isLoading,
  error,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSwitch: () => void;
  isLoading?: boolean;
  error?: string | null;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <TextInput icon={User} label="Full Name" name="fullName" placeholder="Dr. Maya Patel" autoComplete="name" />
      <TextInput icon={Mail} label="Email Address" name="email" type="email" placeholder="clinician@clinic.com" autoComplete="email" />
      <TextInput icon={BadgeCheck} label="Medical License Number / NPI" name="licenseNumber" placeholder="NPI-1234567890" autoComplete="off" />
      <PasswordInput label="Password" name="password" autoComplete="new-password" />

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
        <input type="checkbox" required className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]" />
        <span>I agree to the Terms & Conditions and confirm this account is for clinical decision support workflows.</span>
      </label>

      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-5 py-4 text-base font-black text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/25 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100"
      >
        {isLoading ? (
          <>
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Creating Account...
          </>
        ) : (
          <>
            Create Account
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="text-center text-sm font-semibold text-slate-500">
        Already have an account?{" "}
        <button type="button" onClick={onSwitch} className="font-black text-[#2563EB] transition-all duration-200 hover:text-blue-700">
          Sign In
        </button>
      </p>
    </form>
  );
}

function OtpForm({ onVerify, email, devOtp, mode }: { onVerify: () => void; email: string; devOtp?: string; mode: "login" | "register" }) {
  const [otp, setOtp] = useState(devOtp ? devOtp.split("").slice(0, 6) : ["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds
  const [resentAt, setResentAt] = useState<number | null>(null);
  const [currentDevOtp, setCurrentDevOtp] = useState(devOtp);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const isComplete = otp.every(Boolean);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleResend = async () => {
    setIsResending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode }),
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setCountdown(600);
        setResentAt(Date.now());

        if (data?.devOtp) {
          const nextOtp = data.devOtp.split("").slice(0, 6);
          setCurrentDevOtp(data.devOtp);
          setOtp(nextOtp);
          inputRefs.current[Math.min(nextOtp.length, 5)]?.focus();
        } else {
          setCurrentDevOtp(undefined);
          setOtp(["", "", "", "", "", ""]);
          inputRefs.current[0]?.focus();
        }
      } else {
        const data = await response.json().catch(() => null);
        setError(data?.message || "Failed to resend code. Please try again.");
      }
    } catch {
      setError("Failed to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isComplete) return;
    setError(null);
    setIsLoading(true);
    try {
      // Route to correct endpoint based on flow:
      // login  -> /verify-otp  (in-memory OTP set by /login)
      // register -> /verify-email (DB-backed token set by /register)
      if (mode === "login") {
        await ApiClient.post("/api/auth/verify-otp", { email, otp: otp.join("") });
      } else {
        await ApiClient.post("/api/auth/verify-email", { email, code: otp.join("") });
      }

      onVerify();
    } catch (err: any) {
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };


  const updateDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);

    if (digit && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6).split("");
    if (!digits.length) return;

    const nextOtp = ["", "", "", "", "", ""];
    digits.forEach((digit, index) => {
      nextOtp[index] = digit;
    });
    setOtp(nextOtp);
    inputRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  return (
    <form onSubmit={handleFormSubmit} className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
        <LockKeyhole className="h-8 w-8" aria-hidden="true" />
      </div>
      <h2 className="mt-6 text-3xl font-black tracking-tight text-[#1E293B]">Verify your identity</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
        We&apos;ve sent a secure verification code to your email.
      </p>
      {currentDevOtp && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-700">
          Dev mode: OTP auto-filled - <span className="font-mono">{currentDevOtp}</span>
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 flex justify-center gap-2 sm:gap-3" aria-label="Six digit verification code">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            value={digit}
            inputMode="numeric"
            maxLength={1}
            onChange={(event) => updateDigit(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onPaste={(event) => {
              event.preventDefault();
              handlePaste(event.clipboardData.getData("text"));
            }}
            className="h-12 w-11 rounded-2xl border border-slate-200 bg-white text-center text-xl font-black text-[#1E293B] shadow-sm outline-none transition-all duration-200 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100 sm:h-14 sm:w-14"
            aria-label={`Verification digit ${index + 1}`}
          />
        ))}
      </div>

      <button
        type="submit"
        disabled={!isComplete || isLoading}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-5 py-4 text-base font-black text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/25 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100"
      >
        {isLoading ? (
          <>
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Verifying...
          </>
        ) : (
          <>
            Verify & Continue
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </>
        )}
      </button>
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending || countdown > 540}
          className="text-sm font-semibold text-[#2563EB] hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed transition-colors"
        >
          {isResending ? "Sending..." : countdown > 540 ? `Resend available in ${formatCountdown(countdown - 540)}` : "Resend OTP"}
        </button>
        {resentAt && (
          <p className="mt-2 text-xs font-semibold text-slate-500">
            New verification code sent.
          </p>
        )}
      </div>
    </form>
  );
}

export function AuthFlowModal({ initialMode, isOpen, onClose }: AuthFlowModalProps) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [step, setStep] = useState<"form" | "otp" | "forgot">("form");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    setMode(initialMode);
    setStep("form");
    setPendingEmail("");
    setForgotEmail("");
    setForgotSent(false);
    setError(null);
    setIsLoading(false);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [initialMode, isOpen]);

  // Escape key handler and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      // Focus trap: cycle focus within the modal
      if (event.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Auto-focus first focusable element in modal
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector<HTMLElement>(
          'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    }, 100);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");


    // Client-side validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (mode === "register") {
      const fullNameVal = String(formData.get("fullName") ?? "");
      const licenseNumberVal = String(formData.get("licenseNumber") ?? "");
      if (!fullNameVal.trim()) { setError("Full name is required."); return; }
      if (!licenseNumberVal.trim()) { setError("Medical license number is required."); return; }
    }
    setIsLoading(true);

    try {
      let responseData: any;

      if (mode === "register") {
        const fullName = String(formData.get("fullName") ?? "");
        const licenseNumber = String(formData.get("licenseNumber") ?? "");

        responseData = await ApiClient.post("/api/auth/register", { fullName, email, password, licenseNumber });
      } else {
        responseData = await ApiClient.post("/api/auth/login", { email, password });
      }
      setPendingEmail(email);
      if (responseData?.devOtp) setDevOtp(responseData.devOtp);
      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    onClose();
    setLocation("/dashboard");
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await ApiClient.post("/api/auth/forgot-password", { email: forgotEmail });
      setForgotSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={modalRef} className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-950/25 lg:grid-cols-[0.4fr_0.6fr]"
      >
        <AuthBrandPanel />

        <section className="relative flex items-center justify-center bg-white px-6 py-10 sm:px-10 lg:px-14">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-all duration-200 hover:bg-slate-200 hover:text-[#1E293B] focus:outline-none focus:ring-4 focus:ring-blue-100"
            aria-label="Close authentication"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="w-full max-w-md">
            {step === "forgot" ? (
              <motion.div key="forgot" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
                    <LockKeyhole className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <h2 className="mt-6 text-3xl font-black tracking-tight text-[#1E293B]">Forgot Password</h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
                    {forgotSent
                      ? "If an account exists with that email, a reset link has been sent. Check your inbox and follow the instructions."
                      : "Enter your email address and we'll send you a link to reset your password."}
                  </p>
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                    {error}
                  </div>
                )}

                {forgotSent ? (
                  <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" aria-hidden="true" />
                    <p className="mt-3 text-base font-bold text-green-800">Reset link sent</p>
                    <p className="mt-2 text-sm text-green-700">
                      Please check your email for the password reset link. It expires in 1 hour.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="mt-8 space-y-5">
                    <TextInput
                      icon={Mail}
                      label="Email Address"
                      name="forgotEmail"
                      type="email"
                      placeholder="clinician@clinic.com"
                      autoComplete="email"
                      value={forgotEmail}
                      onChange={(event) => setForgotEmail(event.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !forgotEmail}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-5 py-4 text-base font-black text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/25 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100"
                    >
                      {isLoading ? (
                        <>
                          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          Send Reset Link
                          <Mail className="h-5 w-5" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                <button
                  type="button"
                  onClick={() => { setStep("form"); setForgotSent(false); setError(null); }}
                  className="mt-6 w-full text-center text-sm font-bold text-slate-500 transition-all duration-200 hover:text-[#2563EB]"
                >
                  Back to sign in
                </button>
              </motion.div>
            ) : step === "form" ? (
              <motion.div key={mode} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                <div className="mb-8">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2563EB]">
                    {mode === "login" ? "Secure sign in" : "Provider onboarding"}
                  </p>
                  <h1 id="auth-title" className="mt-3 text-3xl font-black tracking-tight text-[#1E293B] sm:text-4xl">
                    {mode === "login" ? "Welcome back" : "Create your clinical account"}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {mode === "login"
                      ? "Access patient risk models, longitudinal insights, and clinical decision support tools."
                      : "Start a secure Clinical Insight workspace for preventive diabetes screening."}
                  </p>
                </div>

                {mode === "login" ? (
                  <LoginForm
                    email={loginEmail}
                    password={loginPassword}
                    onEmailChange={setLoginEmail}
                    onPasswordChange={setLoginPassword}
                    onSubmit={handleSubmit}
                    onSwitch={() => setMode("register")}
                    onForgotPassword={() => { setStep("forgot"); setForgotEmail(loginEmail); }}
                    isLoading={isLoading}
                    error={error}
                  />
                ) : (
                  <RegisterForm
                    onSubmit={handleSubmit}
                    onSwitch={() => setMode("login")}
                    isLoading={isLoading}
                    error={error}
                  />
                )}

                <SecurityNotice />
              </motion.div>
            ) : (
              <motion.div key="otp" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                <OtpForm onVerify={handleVerify} email={pendingEmail} devOtp={devOtp} mode={mode} />
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="mt-6 w-full text-center text-sm font-bold text-slate-500 transition-all duration-200 hover:text-[#2563EB]"
                >
                  Back to {mode === "login" ? "sign in" : "registration"}
                </button>
                <SecurityNotice />
              </motion.div>
            )}
          </div>
        </section>
      </motion.div>
    </div>
  );
}
