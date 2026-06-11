import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { ApiClient } from "@/lib/apiClient";
import { AuthLayout } from "./AuthLayout";
import { AuthCard } from "./AuthCard";
import { FormField } from "./FormField";
import { AuthButton } from "./AuthButton";
import { PasswordStrength } from "./PasswordStrength";
import { OtpInput } from "./OtpInput";

export type AuthMode = "login" | "register";
type Step = "form" | "otp" | "forgot";

interface AuthFlowProps {
  initialMode?: AuthMode;
  onSuccess?: () => void;
}

export function AuthFlow({ initialMode = "login", onSuccess }: AuthFlowProps) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [step, setStep] = useState<Step>("form");
  
  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  
  // OTP States
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [countdown, setCountdown] = useState(600); // 10 minutes total
  const [resendCooldown, setResendCooldown] = useState(60); // 60 seconds before resend

  // Forgot Password States
  const [forgotSent, setForgotSent] = useState(false);

  // UI States
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Timers
  useEffect(() => {
    if (step !== "otp") return;
    
    const timer = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
      setResendCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [step]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email) { setError("Email is required."); return; }
    if (!password) { setError("Password is required."); return; }
    
    if (mode === "register") {
      if (!fullName) { setError("Full name is required."); return; }
      if (!licenseNumber) { setError("Medical license number is required."); return; }
      if (password !== confirmPassword) { setError("Passwords do not match."); return; }
      if (password.length < 8) { setError("Password is too weak."); return; }
    }

    setIsLoading(true);
    try {
      let responseData: any;
      if (mode === "register") {
        responseData = await ApiClient.post("/api/auth/register", { fullName, email, password, licenseNumber });
      } else {
        responseData = await ApiClient.post("/api/auth/login", { email, password });
      }
      
      if (responseData?.devOtp) setDevOtp(responseData.devOtp);
      setStep("otp");
      setCountdown(600);
      setResendCooldown(60);
      setOtp(responseData?.devOtp || "");
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    
    setError(null);
    setIsLoading(true);
    try {
      if (mode === "login") {
        await ApiClient.post("/api/auth/verify-otp", { email, otp });
      } else {
        await ApiClient.post("/api/auth/verify-email", { email, code: otp });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (onSuccess) {
        onSuccess();
      } else {
        setLocation("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Verification failed. Please check the code and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode }),
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Failed to resend code.");
      }
      
      const data = await response.json();
      setCountdown(600);
      setResendCooldown(60);
      if (data?.devOtp) {
        setDevOtp(data.devOtp);
        setOtp(data.devOtp);
      } else {
        setDevOtp(undefined);
        setOtp("");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) { setError("Please enter your email address."); return; }
    
    setError(null);
    setIsLoading(true);
    try {
      await ApiClient.post("/api/auth/forgot-password", { email });
      setForgotSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setError(null);
    setMode(newMode);
    setStep("form");
  };

  // -------------------------------------------------------------
  // Render: Forgot Password Step
  // -------------------------------------------------------------
  if (step === "forgot") {
    return (
      <AuthLayout>
        <AuthCard title="Reset Password">
          {forgotSent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                If an account exists with {email}, a reset link has been sent. Check your inbox.
              </p>
              <button
                onClick={() => setStep("form")}
                className="mt-6 text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Return to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword}>
              <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</div>}
              
              <FormField
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="clinician@clinic.com"
                required
              />
              
              <AuthButton type="submit" isLoading={isLoading} loadingText="Sending...">
                Send Reset Link
              </AuthButton>
              
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </AuthCard>
      </AuthLayout>
    );
  }

  // -------------------------------------------------------------
  // Render: OTP Verification Step
  // -------------------------------------------------------------
  if (step === "otp") {
    return (
      <AuthLayout>
        <AuthCard title="Verify Your Email" subtitle="We've sent a secure verification code to your email address.">
          <form onSubmit={handleOtpVerify}>
            {error && <div className="mb-6 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</div>}
            {devOtp && (
              <div className="mb-6 rounded-md bg-amber-50 p-3 text-sm font-mono text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                Dev Mode OTP: {devOtp}
              </div>
            )}

            <div className="mb-8 flex justify-center">
              <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
            </div>

            <div className="mb-6 text-center text-sm text-slate-600 dark:text-slate-400">
              {countdown > 0 ? (
                <p>Code expires in <span className="font-mono font-semibold">{formatTime(countdown)}</span></p>
              ) : (
                <p className="text-red-500">Code expired.</p>
              )}
            </div>

            <AuthButton
              type="submit"
              disabled={otp.length !== 6 || countdown === 0}
              isLoading={isLoading}
              loadingText="Verifying..."
            >
              Verify & Continue
            </AuthButton>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isLoading}
                className="text-sm font-semibold text-blue-600 disabled:text-slate-400 dark:text-blue-400 dark:disabled:text-slate-600 hover:underline disabled:no-underline"
              >
                {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : "Resend Code"}
              </button>
            </div>
          </form>
        </AuthCard>
      </AuthLayout>
    );
  }

  // -------------------------------------------------------------
  // Render: Login / Register Form Step
  // -------------------------------------------------------------
  return (
    <AuthLayout>
      <AuthCard title={mode === "login" ? "Sign In" : "Create Account"}>
        <form onSubmit={handleAuthSubmit}>
          {error && <div className="mb-6 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

          {mode === "register" && (
            <>
              <FormField
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Maya Patel"
                required
              />
              <FormField
                label="Medical License Number / NPI"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="NPI-1234567890"
                required
              />
            </>
          )}

          <FormField
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="clinician@clinic.com"
            required
          />

          <FormField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {mode === "register" && (
            <div className="mb-5">
              <PasswordStrength password={password} />
              <div className="mt-4">
                <FormField
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="!mb-1"
                />
                {confirmPassword && (
                  <p className={`text-xs ${password === confirmPassword ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                    {password === confirmPassword ? "Passwords match" : "Passwords do not match"}
                  </p>
                )}
              </div>
            </div>
          )}

          {mode === "login" && (
            <div className="mb-6 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900" />
                Remember Me
              </label>
              <button
                type="button"
                onClick={() => { setError(null); setStep("forgot"); }}
                className="text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Forgot Password?
              </button>
            </div>
          )}

          <AuthButton
            type="submit"
            isLoading={isLoading}
            loadingText={mode === "login" ? "Signing In..." : "Creating Account..."}
            disabled={mode === "register" && (password !== confirmPassword || password.length < 8)}
          >
            {mode === "login" ? "Sign In" : "Create Account"}
          </AuthButton>

          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
              className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              {mode === "login" ? "Register" : "Sign In"}
            </button>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
