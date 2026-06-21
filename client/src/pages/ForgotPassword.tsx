import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ApiClient } from "@/lib/apiClient";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthCard } from "@/components/auth/AuthCard";
import { FormField } from "@/components/auth/FormField";
import { AuthButton } from "@/components/auth/AuthButton";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Forgot Password - Clinical Insight Engine";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email) {
      setError("Email is required.");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    try {
      await ApiClient.post("/api/auth/forgot-password", { email });
      setSuccess("If an account exists with this email, a password reset link has been sent.");
    } catch (err: unknown) {
      setError((err as Error).message || "Unable to connect to server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard title="Reset Password">
        {success ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{success}</p>
            <button
              onClick={() => setLocation("/login")}
              className="mt-6 text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Return to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {error}
              </div>
            )}
            <FormField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="clinician@clinic.com"
              required
            />
            <AuthButton type="submit" isLoading={isLoading} loadingText="Sending...">
              Send Reset Link
            </AuthButton>
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setLocation("/login")}
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