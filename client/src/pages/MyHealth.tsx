import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, LogOut, Download, AlertTriangle, Heart, Activity, FileText, ChevronLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PatientUser {
  id: string;
  patientName: string;
  email: string;
}

interface Assessment {
  id: number;
  patientName: string;
  gender: string;
  age: number;
  hypertension: boolean;
  heartDisease: boolean;
  smokingHistory: string;
  bmi: number;
  hba1cLevel: number;
  bloodGlucoseLevel: number;
  riskScore: number;
  riskCategory: string;
  factors: { name: string; impact: string; description: string }[];
  clinicianAdvice?: string[];
  patientAdvice?: string[];
  confidenceInterval?: string | null;
  modelConfidence?: number | null;
  createdAt: string;
}

interface TrendPoint {
  date: string;
  riskScore: number;
  riskCategory: string;
}

function getToken(): string | null {
  return localStorage.getItem("patient_token");
}

function setToken(token: string) {
  localStorage.setItem("patient_token", token);
}

function clearToken() {
  localStorage.removeItem("patient_token");
}

function riskColor(category: string): string {
  switch (category) {
    case "HIGH": return "text-red-600 bg-red-100";
    case "MODERATE": return "text-amber-600 bg-amber-100";
    default: return "text-green-600 bg-green-100";
  }
}

function riskColorHex(category: string): string {
  switch (category) {
    case "HIGH": return "#dc2626";
    case "MODERATE": return "#d97706";
    default: return "#16a34a";
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return dateStr; }
}

export default function MyHealth() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<PatientUser | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/patient-login");
      return;
    }
    fetchUser(token);
  }, []);

  async function fetchUser(token: string) {
    try {
      const res = await fetch("/api/patient/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setUser(data.user);
      fetchAssessments(token);
      fetchTrends(token);
    } catch {
      clearToken();
      navigate("/patient-login");
    }
  }

  async function fetchAssessments(token: string) {
    try {
      const res = await fetch("/api/patient/assessments?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setAssessments(data.data ?? []);
    } catch (err) {
      setError("Failed to load assessments.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchTrends(token: string) {
    try {
      const res = await fetch("/api/patient/trends", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setTrends(data ?? []);
    } catch {}
  }

  function handleLogout() {
    clearToken();
    navigate("/patient-login");
  }

  function handleDownloadPdf(assessment: Assessment) {
    const { jsPDF } = window as any;
    if (!jsPDF) {
      setError("PDF library not loaded.");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Patient Health Summary", 14, 22);
    doc.setFontSize(11);
    doc.text(`Patient: ${assessment.patientName}`, 14, 32);
    doc.text(`Date: ${formatDate(assessment.createdAt)}`, 14, 40);
    doc.text(`Risk Score: ${assessment.riskScore.toFixed(1)}%`, 14, 50);
    doc.text(`Risk Category: ${assessment.riskCategory}`, 14, 58);
    doc.text(`Age: ${assessment.age}  |  Gender: ${assessment.gender}`, 14, 66);
    doc.text(`BMI: ${assessment.bmi}  |  HbA1c: ${assessment.hba1cLevel}%`, 14, 74);
    doc.text(`Blood Glucose: ${assessment.bloodGlucoseLevel} mg/dL`, 14, 82);
    doc.save(`health-summary-${assessment.id}.pdf`);
  }

  function getPatientAdvice(assessment: Assessment): string[] {
    if (assessment.patientAdvice && assessment.patientAdvice.length > 0) {
      return assessment.patientAdvice;
    }
    if (assessment.riskCategory === "HIGH") {
      return ["Please schedule an appointment with your clinician to check diagnostic lab ranges."];
    }
    if (assessment.riskCategory === "MODERATE") {
      return ["Making positive dietary changes and staying active helps lower type 2 diabetes risk."];
    }
    return ["Continue maintaining a healthy, balanced lifestyle and regular physical activity."];
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedAssessment) {
    const sa = selectedAssessment;
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="mx-auto max-w-4xl p-6">
          <Button variant="ghost" onClick={() => setSelectedAssessment(null)} className="mb-4">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to my health
          </Button>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Assessment #{sa.id}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(sa)}>
                  <Download className="mr-2 h-4 w-4" /> PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-medium">{formatDate(sa.createdAt)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Risk Score</p>
                  <p className="font-medium">{sa.riskScore.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Category</p>
                  <Badge className={riskColor(sa.riskCategory)}>{sa.riskCategory}</Badge>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Age/Gender</p>
                  <p className="font-medium">{sa.age} / {sa.gender}</p>
                </div>
              </div>

              <div className="rounded-lg border bg-green-50 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-800">
                  <Heart className="h-4 w-4" /> Your Health Advice
                </h3>
                <ul className="space-y-1">
                  {getPatientAdvice(sa).map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                      <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-green-500" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-700">Key Factors</h3>
                <div className="space-y-2">
                  {sa.factors.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                      {f.impact === "positive" ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      ) : (
                        <Activity className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-gray-500">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">BMI</p>
                  <p className="font-medium">{sa.bmi}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">HbA1c</p>
                  <p className="font-medium">{sa.hba1cLevel}%</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Blood Glucose</p>
                  <p className="font-medium">{sa.bloodGlucoseLevel} mg/dL</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Health Portal</h1>
            {user && <p className="text-sm text-gray-500">Welcome, {user.patientName}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <Tabs defaultValue="assessments" className="space-y-6">
          <TabsList>
            <TabsTrigger value="assessments"><FileText className="mr-2 h-4 w-4" /> My Assessments</TabsTrigger>
            <TabsTrigger value="trends"><Activity className="mr-2 h-4 w-4" /> Risk Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="assessments">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assessment History</CardTitle>
              </CardHeader>
              <CardContent>
                {assessments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">No assessments found.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Risk Score</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assessments.map((a) => (
                        <TableRow key={a.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedAssessment(a)}>
                          <TableCell className="text-sm">{formatDate(a.createdAt)}</TableCell>
                          <TableCell className="font-medium">{a.riskScore.toFixed(1)}%</TableCell>
                          <TableCell>
                            <Badge className={riskColor(a.riskCategory)}>{a.riskCategory}</Badge>
                          </TableCell>
                          <TableCell>{a.age}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDownloadPdf(a); }}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Risk Score Trends</CardTitle>
              </CardHeader>
              <CardContent>
                {trends.length < 2 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    {trends.length === 1 ? "One assessment recorded. More data needed for a trend chart." : "No trend data available yet."}
                  </p>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends.map((t) => ({ ...t, date: formatDate(t.date) }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="riskScore" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} name="Risk Score (%)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
