import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, LogOut, Download, AlertTriangle, Heart, Activity, FileText, ChevronLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatReadableDate } from "@/utils/dateFormat";
import { EmptyState } from "@/components/EmptyState";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { ApiClient } from "@/lib/apiClient";

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
    case "HIGH": return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950/50";
    case "MODERATE": return "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/50";
    default: return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950/50";
  }
}

function riskColorHex(category: string): string {
  switch (category) {
    case "HIGH": return "#dc2626";
    case "MODERATE": return "#d97706";
    default: return "#16a34a";
  }
}

export default function MyHealth() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<PatientUser | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

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
      const response = await ApiClient.requestRaw("/api/patient/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
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
      const response = await ApiClient.requestRaw("/api/patient/assessments?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setAssessments(data.data ?? []);
    } catch (err) {
      setError(t("myHealth.loadError"));
    } finally {
      setLoading(false);
    }
  }

  async function fetchTrends(token: string) {
    try {
      const response = await ApiClient.requestRaw("/api/patient/trends", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setTrends(data ?? []);
    } catch {}
  }

  function handleLogout() {
    clearToken();
    navigate("/patient-login");
  }

  function handleDownloadPdf(assessment: Assessment) {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(t("myHealth.pdfTitle"), 14, 22);
    doc.setFontSize(11);
    doc.text(t("myHealth.pdfPatient", { name: assessment.patientName }), 14, 32);
    doc.text(t("myHealth.pdfDate", { date: formatReadableDate(assessment.createdAt, { includeTime: false }) }), 14, 40);
    doc.text(t("myHealth.pdfRiskScore", { score: assessment.riskScore.toFixed(1) }), 14, 50);
    doc.text(t("myHealth.pdfRiskCategory", { category: assessment.riskCategory }), 14, 58);
    doc.text(t("myHealth.pdfAgeGender", { age: assessment.age, gender: assessment.gender }), 14, 66);
    doc.text(t("myHealth.pdfBmi", { bmi: assessment.bmi }) + "  |  " + t("myHealth.pdfHba1c", { hba1c: assessment.hba1cLevel }), 14, 74);
    doc.text(t("myHealth.pdfGlucose", { glucose: assessment.bloodGlucoseLevel }), 14, 82);
    doc.save(`health-summary-${assessment.id}.pdf`);
  }

  function getPatientAdvice(assessment: Assessment): string[] {
    if (assessment.patientAdvice && assessment.patientAdvice.length > 0) {
      return assessment.patientAdvice;
    }
    if (assessment.riskCategory === "HIGH") {
      return [t("myHealth.fallbackAdviceHigh")];
    }
    if (assessment.riskCategory === "MODERATE") {
      return [t("myHealth.fallbackAdviceModerate")];
    }
    return [t("myHealth.fallbackAdviceLow")];
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedAssessment) {
    const sa = selectedAssessment;
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:p-6">
          <Button variant="ghost" onClick={() => setSelectedAssessment(null)} className="mb-4 min-h-[44px] min-w-[44px]">
            <ChevronLeft className="mr-2 h-5 w-5" /> {t("myHealth.backToHealth")}
          </Button>
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-xl sm:text-2xl">{t("myHealth.assessmentLabel", { id: sa.id })}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(sa)} className="min-h-[44px] self-start sm:self-auto">
                  <Download className="mr-2 h-5 w-5" /> {t("myHealth.pdfDownload")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-gray-50 p-3 sm:p-4">
                  <p className="text-xs text-gray-500">{t("myHealth.date")}</p>
                  <p className="font-medium text-sm sm:text-base">{formatReadableDate(sa.createdAt, { includeTime: false })}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 sm:p-4">
                  <p className="text-xs text-gray-500">{t("myHealth.riskScore")}</p>
                  <p className="font-medium text-sm sm:text-base">{sa.riskScore.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 sm:p-4">
                  <p className="text-xs text-gray-500">{t("myHealth.category")}</p>
                  <Badge className={riskColor(sa.riskCategory) + " text-xs sm:text-sm"}>{sa.riskCategory}</Badge>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 sm:p-4">
                  <p className="text-xs text-gray-500">{t("myHealth.ageGender")}</p>
                  <p className="font-medium text-sm sm:text-base">{sa.age} / {sa.gender}</p>
                </div>
              </div>

              <div className="rounded-lg border bg-green-50 p-4 sm:p-5">
                <h3 className="mb-2 flex items-center gap-2 text-sm sm:text-base font-semibold text-green-800">
                  <Heart className="h-5 w-5" /> {t("myHealth.yourHealthAdvice")}
                </h3>
                <ul className="space-y-1.5">
                  {getPatientAdvice(sa).map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-300">
                      <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-green-500" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">{t("myHealth.keyFactors")}</h3>
                <div className="space-y-2">
                  {sa.factors.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border dark:border-gray-700 p-3 dark:bg-gray-800/50">
                      {f.impact === "positive" ? (
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                      ) : (
                        <Activity className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium dark:text-gray-100">{f.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("myHealth.bmi")}</p>
                  <p className="font-medium dark:text-gray-100">{sa.bmi}</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("myHealth.hba1c")}</p>
                  <p className="font-medium dark:text-gray-100">{sa.hba1cLevel}%</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("myHealth.bloodGlucose")}</p>
                  <p className="font-medium dark:text-gray-100">{sa.bloodGlucoseLevel} mg/dL</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-950">
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80 dark:border-gray-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("myHealth.title")}</h1>
            {user && <p className="text-sm text-gray-500 dark:text-gray-400">{t("myHealth.welcome", { name: user.patientName })}</p>}
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="minimal" />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="min-h-[44px] shrink-0">
              <LogOut className="mr-2 h-5 w-5" /> <span>{t("myHealth.signOut")}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 sm:p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-3 text-sm text-red-700 dark:text-red-400">{error}</div>
        )}

        <Tabs defaultValue="assessments" className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="assessments" className="min-h-[44px] flex-1 sm:flex-none"><FileText className="mr-2 h-5 w-5" /> {t("myHealth.tabAssessments")}</TabsTrigger>
              <TabsTrigger value="trends" className="min-h-[44px] flex-1 sm:flex-none"><Activity className="mr-2 h-5 w-5" /> {t("myHealth.tabTrends")}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="assessments">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg dark:text-gray-100">{t("myHealth.assessmentHistory")}</CardTitle>
              </CardHeader>
              <CardContent className="px-0 sm:px-6">
                {assessments.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title={t('myHealth.emptyAssessments.title')}
                    description={t('myHealth.emptyAssessments.description')}
                    actionLabel={t('myHealth.emptyAssessments.actionLabel')}  
                    actionOnClick={() => {
                      const token = getToken();
                      if (token) {
                        setLoading(true);
                        fetchAssessments(token);
                        fetchTrends(token);
                      }
                    }}
                    secondaryActionLabel={t('myHealth.emptyAssessments.secondaryActionLabel')}
                    secondaryActionOnClick={handleLogout}
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("myHealth.date")}</TableHead>
                        <TableHead>{t("myHealth.riskScore")}</TableHead>
                        <TableHead>{t("myHealth.category")}</TableHead>
                        <TableHead>{t("myHealth.age")}</TableHead>
                        <TableHead className="text-right">{t("myHealth.action")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assessments.map((a) => (
                        <TableRow key={a.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedAssessment(a)}>
                          <TableCell className="text-sm sticky left-0 bg-white z-10">{formatReadableDate(a.createdAt, { includeTime: false })}</TableCell>
                          <TableCell className="font-medium">{a.riskScore.toFixed(1)}%</TableCell>
                          <TableCell>
                            <Badge className={riskColor(a.riskCategory)}>{a.riskCategory}</Badge>
                          </TableCell>
                          <TableCell>{a.age}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDownloadPdf(a); }} className="min-h-[44px] min-w-[44px]">
                              <Download className="h-5 w-5" />
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
                <CardTitle className="text-lg dark:text-gray-100">{t("myHealth.riskTrends")}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {trends.length < 2 ? (
                  <EmptyState
                    icon={Activity}
                    title={trends.length === 1 ? t('myHealth.emptyTrends.titleOne') : t('myHealth.emptyTrends.titleNone')}
                    description={
                      trends.length === 1
                        ? t('myHealth.emptyTrends.descriptionOne')
                        : t('myHealth.emptyTrends.descriptionNone')
                    }
                    actionLabel={t('myHealth.emptyTrends.actionLabel')}
                    actionOnClick={() => {
                      const token = getToken();
                      if (token) {
                        fetchTrends(token);
                      }
                    }}
                  />
                ) : (
                  <div className="h-60 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends.map((t) => ({ ...t, date: formatReadableDate(t.date, { includeTime: false }) }))}>
                        <CartesianGrid strokeDasharray="3 3" className="dark:stroke-gray-700" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} className="dark:text-gray-400" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="dark:text-gray-400" />
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
