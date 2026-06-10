import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Stethoscope } from "lucide-react";

export default function PatientLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patient/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Login failed.");
        return;
      }
      localStorage.setItem("patient_token", data.token);
      navigate("/my-health");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!patientName.trim()) {
      setError("Patient name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patient/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName, email, password, phone: phone || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Registration failed.");
        return;
      }
      localStorage.setItem("patient_token", data.token);
      navigate("/my-health");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center px-4 sm:px-6">
          <div className="mx-auto mb-2 flex h-14 w-14 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-blue-100">
            <Stethoscope className="h-7 w-7 sm:h-6 sm:w-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl sm:text-2xl">Patient Portal</CardTitle>
          <CardDescription className="text-sm sm:text-base">Access your health assessments and recommendations</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="min-h-[44px]">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="min-h-[44px]">Register</TabsTrigger>
            </TabsList>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="mt-4 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm sm:text-base">Email</Label>
                  <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="min-h-[48px] text-base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm sm:text-base">Password</Label>
                  <Input id="login-password" type="password" placeholder="••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="min-h-[48px] text-base" />
                </div>
                <Button type="submit" className="w-full min-h-[48px] text-base" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="mt-4 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="reg-name" className="text-sm sm:text-base">Patient Name (as known to your clinician)</Label>
                  <Input id="reg-name" placeholder="John Doe" value={patientName} onChange={(e) => setPatientName(e.target.value)} required className="min-h-[48px] text-base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email" className="text-sm sm:text-base">Email</Label>
                  <Input id="reg-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="min-h-[48px] text-base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password" className="text-sm sm:text-base">Password (min 6 characters)</Label>
                  <Input id="reg-password" type="password" placeholder="••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="min-h-[48px] text-base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-phone" className="text-sm sm:text-base">Phone (optional)</Label>
                  <Input id="reg-phone" type="tel" placeholder="+1-555-0123" value={phone} onChange={(e) => setPhone(e.target.value)} className="min-h-[48px] text-base" />
                </div>
                <Button type="submit" className="w-full min-h-[48px] text-base" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
