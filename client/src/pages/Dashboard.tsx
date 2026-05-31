import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { AssessmentResult } from "@/components/AssessmentResult";
import { useCreateAssessment, useAssessments } from "@/hooks/use-assessments";
import { Activity, AlertCircle, Clock3, HeartPulse, Loader2, ShieldCheck, TrendingUp, UserCircle, Info } from "lucide-react";
import { api, type AssessmentPreviewResponse, type AssessmentResponse } from "@shared/routes";
import { insertAssessmentSchema } from "@shared/schema";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const formSchema = insertAssessmentSchema.pick({
  gender: true,
  age: true,
  hypertension: true,
  heartDisease: true,
  smokingHistory: true,
  bmi: true,
  hba1cLevel: true,
  bloodGlucoseLevel: true,
});

type FormData = z.infer<typeof formSchema>;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#1E293B] placeholder-slate-400 shadow-sm outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const getInputClass = (hasError: boolean) =>
  `${inputClass} ${hasError ? "border-red-500 focus:border-red-500 focus:ring-red-100 ring-2 ring-red-500/20" : ""}`;

const labelClass = "text-sm font-bold text-[#1E293B]";

const sectionHeadingClass =
  "flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-500";

// dashboardStats removed and calculated dynamically inside the component

function getRiskBadgeClass(category?: string) {
  switch ((category ?? "").toUpperCase()) {
    case "LOW":
      return "border-green-200 bg-green-50 text-green-700";
    case "MODERATE":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "HIGH":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function Dashboard() {
  useEffect(() => {
    document.title = "Clinical Insight Engine - Dashboard";
  }, []);

  const [result, setResult] = useState<AssessmentResponse | null>(null);
  const [preview, setPreview] = useState<AssessmentPreviewResponse | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const { mutate: createAssessment, isPending, error } = useCreateAssessment();

  const { data: assessments } = useAssessments();

  const stats = useMemo(() => {
    const list = assessments ?? [];
    const total = list.length;
    const avgRisk = total > 0 ? list.reduce((sum, item) => sum + Number(item.riskScore), 0) / total : 0;
    const highRisk = total > 0 ? (list.filter(item => (item.riskCategory || "").toUpperCase() === "HIGH").length / total) * 100 : 0;

    return [
      { label: "Total Assessments", value: String(total), icon: Activity },
      { label: "Average Risk Score", value: `${avgRisk.toFixed(1)}%`, icon: TrendingUp },
      { label: "High Risk Cases", value: `${highRisk.toFixed(0)}%`, icon: AlertCircle },
    ];
  }, [assessments]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hypertension: false,
      heartDisease: false,
      smokingHistory: "never",
      gender: "Female",
      age: undefined,
      bmi: undefined,
      hba1cLevel: undefined,
      bloodGlucoseLevel: undefined,
    },
  });

  const onSubmit = (data: FormData) => {
    createAssessment(data, {
      onSuccess: (data) => {
        setResult(data);
        localStorage.removeItem("clinical-insight-assessment-draft");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const watchedValues = watch();
  const isHypertension = watch("hypertension");
  const isHeartDisease = watch("heartDisease");

  const parsedForPreview = useMemo(() => formSchema.safeParse(watchedValues), [watchedValues]);

  // Load draft from localStorage on mount — clear immediately after loading
  // so it only pre-fills the form once (not on every subsequent visit)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("clinical-insight-assessment-draft");
      if (!raw) return;
      // Remove immediately so stale draft never pre-fills on next visit
      localStorage.removeItem("clinical-insight-assessment-draft");
      const draft = JSON.parse(raw);
      if (draft && typeof draft === "object") {
        const allowedKeys = [
          "gender", "age", "hypertension", "heartDisease",
          "smokingHistory", "bmi", "hba1cLevel", "bloodGlucoseLevel",
        ];
        Object.entries(draft).forEach(([k, v]) => {
          if (!allowedKeys.includes(k)) return;
          try {
            setValue(k as keyof FormData, v as any, { shouldDirty: true });
          } catch (e) {}
        });
      }
    } catch (e) {
      // ignore malformed draft
    }
  }, [setValue]);

  useEffect(() => {
    if (!parsedForPreview.success || result) {
      setPreview(null);
      setPreviewError(null);
      setPreviewPending(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setPreviewPending(true);
        setPreviewError(null);

        const response = await fetch(api.assessments.preview.path, {
          method: api.assessments.preview.method,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(parsedForPreview.data),
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message ?? "Failed to generate preview");
        }

        const parsed = api.assessments.preview.responses[200].parse(data);
        setPreview(parsed);
      } catch (previewErr: any) {
        if (previewErr.name === "AbortError") {
          return;
        }
        setPreviewError(previewErr.message ?? "Failed to generate preview");
      } finally {
        setPreviewPending(false);
      }
    }, 500);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [parsedForPreview, result]);

  // Autosave draft on form changes
  const formData = watch();
  useEffect(() => {
    if (formData && (formData.age || formData.bmi || formData.hba1cLevel || formData.bloodGlucoseLevel || formData.hypertension || formData.heartDisease)) {
      localStorage.setItem("clinical-insight-assessment-draft", JSON.stringify(formData));
    }
  }, [formData]);

  return (
    <AppLayout>
      <TooltipProvider delayDuration={300}>
        <div className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]" />
              Clinical AI workspace
            </div>
            <h1 className="text-3xl md:text-5xl font-black font-display text-[#1E293B] tracking-tight">New Assessment</h1>
            <p className="text-slate-500 mt-3 text-lg max-w-2xl leading-8">
              Enter patient details to run the preventive diabetes and cardiovascular risk model.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[460px]">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-900/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-blue-500/10"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-black text-[#1E293B]">{stat.value}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {result && (
          <div className="mb-12 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-900/[0.03]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h2 className="text-xl font-black text-[#1E293B]">Assessment Complete</h2>
              <button onClick={() => setResult(null)} className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                Clear Result & Start Over
              </button>
            </div>
            <AssessmentResult assessment={result} />
          </div>
        )}

        <div className={`transition-all duration-500 ${result ? "opacity-50 pointer-events-none grayscale" : "opacity-100"}`}>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] transition-all duration-200 md:p-8"
              >
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Assessment Failed</p>
                      <p className="text-sm opacity-90">{error.message}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <section className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                    <h3 className={sectionHeadingClass}>
                      <UserCircle className="w-5 h-5 text-blue-600" /> Demographics
                    </h3>
                    <div className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <label className={labelClass}>Gender</label>
                        <div
                          className={`grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 transition-all duration-200 ${errors.gender ? "ring-2 ring-red-500 bg-red-50/30" : ""}`}
                        >
                          {["Male", "Female", "Other"].map((g) => (
                            <label key={g} className="flex-1 cursor-pointer">
                              <input type="radio" value={g} {...register("gender")} className="peer sr-only" />
                              <div className="text-center px-3 py-3 rounded-xl transition-all duration-200 font-bold text-sm text-slate-500 hover:text-blue-700 peer-checked:bg-white peer-checked:text-blue-700 peer-checked:shadow-sm">
                                {g}
                              </div>
                            </label>
                          ))}
                        </div>
                        {errors.gender && <p className="text-sm text-red-600 mt-1">{errors.gender.message}</p>}
                      </div>


                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <label className={labelClass}>Age</label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                <Info className="w-3.5 h-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-[200px]">Model is optimized for adults aged 18-80. Risk typically increases with age.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <input type="number" {...register("age")} className={getInputClass(!!errors.age)} placeholder="e.g. 45" />
                        {errors.age && <p className="text-sm text-red-600 mt-1">{errors.age.message}</p>}
                      </div>

                      <div className="space-y-2">
                        <label className={labelClass}>Smoking History</label>
                        <select {...register("smokingHistory")} className={`${getInputClass(!!errors.smokingHistory)} appearance-none`}>
                          <option value="never">never</option>
                          <option value="No Info">No Info</option>
                          <option value="current">current</option>
                          <option value="former">former</option>
                        </select>
                        {errors.smokingHistory && <p className="text-sm text-red-600 mt-1">{errors.smokingHistory.message}</p>}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                    <h3 className={sectionHeadingClass}>
                      <HeartPulse className="w-5 h-5 text-blue-600" /> Vitals
                    </h3>
                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <label className={labelClass}>BMI (kg/m²)</label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                <Info className="w-3.5 h-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs max-w-[200px] space-y-1">
                                <p className="font-bold">Body Mass Index:</p>
                                <p>• Normal: 18.5 - 24.9</p>
                                <p>• Overweight: 25.0 - 29.9</p>
                                <p>• Obese: ≥ 30.0</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <input type="number" step="0.1" {...register("bmi")} className={getInputClass(!!errors.bmi)} placeholder="e.g. 25.0" />
                        {errors.bmi && <p className="text-sm text-red-600 mt-1">{errors.bmi.message}</p>}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <label className={labelClass}>HbA1c Level (%)</label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                <Info className="w-3.5 h-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs max-w-[200px] space-y-1">
                                <p className="font-bold">Glycated Hemoglobin:</p>
                                <p>• Normal: &lt; 5.7%</p>
                                <p>• Prediabetes: 5.7% - 6.4%</p>
                                <p>• Diabetes: ≥ 6.5%</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <input type="number" step="0.1" {...register("hba1cLevel")} className={getInputClass(!!errors.hba1cLevel)} placeholder="e.g. 5.7" />
                        {errors.hba1cLevel && <p className="text-sm text-red-600 mt-1">{errors.hba1cLevel.message}</p>}
                      </div>

                      <div className="space-y-2 lg:col-span-2">
                        <div className="flex items-center gap-1.5">
                          <label className={labelClass}>Blood Glucose Level (mg/dL)</label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                <Info className="w-3.5 h-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs max-w-[200px] space-y-1">
                                <p className="font-bold">Fasting Blood Sugar:</p>
                                <p>• Normal: &lt; 100 mg/dL</p>
                                <p>• Prediabetes: 100 - 125 mg/dL</p>
                                <p>• Diabetes: ≥ 126 mg/dL</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <input type="number" {...register("bloodGlucoseLevel")} className={getInputClass(!!errors.bloodGlucoseLevel)} placeholder="e.g. 100" />
                        {errors.bloodGlucoseLevel && <p className="text-sm text-red-600 mt-1">{errors.bloodGlucoseLevel.message}</p>}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                    <h3 className={sectionHeadingClass}>
                      <Activity className="w-5 h-5 text-blue-600" /> Medical History
                    </h3>
                    <div className="mt-4 space-y-4">
                      <label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-white cursor-pointer transition-all duration-200 hover:border-blue-200 hover:shadow-sm">
                        <div>
                          <p className="font-bold text-[#1E293B]">Hypertension</p>
                          <p className="text-xs text-slate-500">Diagnosed high blood pressure</p>
                        </div>
                        <div className={`relative h-7 w-14 shrink-0 rounded-full transition-all duration-200 ${isHypertension ? "bg-blue-600 shadow-md shadow-blue-500/20" : "bg-slate-300"}`}>
                          <input type="checkbox" {...register("hypertension")} className="sr-only" />
                          <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isHypertension ? "translate-x-8" : "translate-x-1"}`} />
                        </div>
                      </label>

                      <label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-white cursor-pointer transition-all duration-200 hover:border-blue-200 hover:shadow-sm">
                        <div>
                          <p className="font-bold text-[#1E293B]">Heart Disease</p>
                          <p className="text-xs text-slate-500">Prior cardiovascular conditions</p>
                        </div>
                        <div className={`relative h-7 w-14 shrink-0 rounded-full transition-all duration-200 ${isHeartDisease ? "bg-blue-600 shadow-md shadow-blue-500/20" : "bg-slate-300"}`}>
                          <input type="checkbox" {...register("heartDisease")} className="sr-only" />
                          <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isHeartDisease ? "translate-x-8" : "translate-x-1"}`} />
                        </div>
                      </label>
                    </div>
                  </section>
                </div>

                <div className="mt-8 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-center text-xs italic text-slate-400">
                    This tool is a prototype for decision support only. It does not provide a medical diagnosis. Always consult a healthcare professional.
                  </p>
                </div>

                <div className="mt-8 border-t border-slate-100 pt-6 flex flex-col md:flex-row justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      reset();
                      localStorage.removeItem("clinical-insight-assessment-draft");
                    }}
                    className="w-full md:w-auto px-8 py-4 rounded-xl font-bold text-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 transition-all duration-200"
                  >
                    Reset Form
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || result !== null}
                    className="w-full md:w-auto px-8 py-4 rounded-xl font-black text-lg border border-blue-200 text-blue-700 bg-white shadow-sm hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing Data...
                      </>
                    ) : (
                      <>
                        <Activity className="w-5 h-5" />
                        Run Risk Assessment
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            <aside className="xl:col-span-2">
              <div className="xl:sticky xl:top-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-[#1E293B]">Real-Time Risk Panel</h3>
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Auto updating</span>
                </div>

                {!parsedForPreview.success && (
                  <p className="text-sm text-slate-500">
                    Complete required fields to see live risk prediction.
                  </p>
                )}

                {previewPending && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating risk preview...
                  </div>
                )}

                {previewError && <p className="text-sm text-red-600">{previewError}</p>}

                {preview && (
                  <>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Risk Score</p>
                      <p className="mt-2 text-5xl font-black text-[#1E293B]">{preview.riskScore.toFixed(1)}%</p>
                      <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-bold ${getRiskBadgeClass(preview.riskCategory)}`}>
                        {preview.riskCategory} Risk
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">Key Drivers</p>
                      <div className="space-y-2">
                        {preview.factors.length > 0 ? (
                          preview.factors.slice(0, 3).map((factor) => (
                            <div key={`${factor.name}-${factor.impact}`} className="rounded-xl border border-slate-200 p-3 bg-white">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-bold text-sm text-[#1E293B]">{factor.name}</p>
                                <span
                                  className={`text-xs font-bold ${factor.impact === "positive" ? "text-red-600" : "text-green-600"}`}
                                >
                                  {factor.impact === "positive" ? "Increases" : "Decreases"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">{factor.description}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No significant factors highlighted yet.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
      </TooltipProvider>
    </AppLayout>
  );
}
