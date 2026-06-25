import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stethoscope, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { ApiClient } from "@/lib/apiClient";

interface FieldErrors {
  patientName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  phone?: string;
}

export default function PatientLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState(() => localStorage.getItem("patient_remember_email") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("patient_remember_email"));

  function validateLogin(): boolean {
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Password is required.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateRegister(): boolean {
    const errors: FieldErrors = {};
    if (!patientName.trim()) errors.patientName = "Patient name is required.";
    if (!email.trim()) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Password is required.";
    else if (password.length < 8) errors.password = "Password must be at least 8 characters.";
    if (!confirmPassword) errors.confirmPassword = "Please confirm your password.";
    else if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validateLogin()) return;
    setLoading(true);
    try {
      const data = await ApiClient.post("/api/patient/auth/login", { email, password }) as { token: string };
      if (rememberMe) {
        localStorage.setItem("patient_remember_email", email);
      } else {
        localStorage.removeItem("patient_remember_email");
      }
      localStorage.setItem("patient_token", data.token);
      navigate("/my-health");
    } catch (err: any) {
      if (err?.status === 429) {
        setError("Too many login attempts. Please try again later.");
      } else {
        setError(err?.message || "Connection error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validateRegister()) return;
    setLoading(true);
    try {
      const data = await ApiClient.post("/api/patient/auth/register", { patientName, email, password, phone: phone || undefined }) as { token: string };
      localStorage.setItem("patient_token", data.token);
      navigate("/my-health");
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("email")) {
        setFieldErrors((prev) => ({ ...prev, email: msg }));
      } else if (msg.toLowerCase().includes("name")) {
        setFieldErrors((prev) => ({ ...prev, patientName: msg }));
      } else {
        setError(msg || "Connection error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-950 p-4">
      <Card className="w-full max-w-md shadow-lg dark:shadow-gray-950/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <Stethoscope className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-xl dark:text-gray-100">Patient Portal</CardTitle>
          <CardDescription>Access your health assessments and recommendations</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="min-h-[44px]">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="min-h-[44px]">Register</TabsTrigger>
            </TabsList>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-3 text-sm text-red-700 dark:text-red-400">{error}</div>
            )}

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="mt-4 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                    className={fieldErrors.email ? "border-red-500" : ""}
                    required
                  />
                  {fieldErrors.email && <p className="text-sm text-red-500">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                      className={`pr-10 ${fieldErrors.password ? "border-red-500" : ""}`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && <p className="text-sm text-red-500">{fieldErrors.password}</p>}
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Remember me
                  </label>
                </div>
                <Button type="submit" className="w-full" isLoading={loading} loadingText="Signing In...">
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="mt-4 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Patient Name (as known to your clinician)</Label>
                  <Input
                    id="reg-name"
                    placeholder="John Doe"
                    value={patientName}
                    onChange={(e) => { setPatientName(e.target.value); clearFieldError("patientName"); }}
                    className={fieldErrors.patientName ? "border-red-500" : ""}
                    required
                  />
                  {fieldErrors.patientName && <p className="text-sm text-red-500">{fieldErrors.patientName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                    className={fieldErrors.email ? "border-red-500" : ""}
                    required
                  />
                  {fieldErrors.email && <p className="text-sm text-red-500">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password (min 8 characters)</Label>
                  <div className="relative">
                    <Input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                      className={`pr-10 ${fieldErrors.password ? "border-red-500" : ""}`}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && <p className="text-sm text-red-500">{fieldErrors.password}</p>}
                  <PasswordStrength password={password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="reg-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword"); }}
                      className={`pr-10 ${fieldErrors.confirmPassword ? "border-red-500" : ""}`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && <p className="text-sm text-red-500">{fieldErrors.confirmPassword}</p>}
                  {confirmPassword && !fieldErrors.confirmPassword && (
                    <p className="text-sm text-emerald-600">
                      {password === confirmPassword ? "Passwords match" : "Passwords do not match"}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-phone" className="text-sm sm:text-base">Phone (optional)</Label>
                  <Input id="reg-phone" type="tel" placeholder="+1-555-0123" value={phone} onChange={(e) => setPhone(e.target.value)} className="min-h-[48px] text-base" />
                </div>
                <Button type="submit" className="w-full min-h-[48px] text-base" isLoading={loading}>
                  Create Account
                </Button>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>HIPAA compliant • Your data is encrypted and secure</span>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
