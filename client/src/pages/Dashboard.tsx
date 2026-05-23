import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { AssessmentResult } from "@/components/AssessmentResult";
import { useCreateAssessment } from "@/hooks/use-assessments";
import { Activity, AlertCircle, Clock3, Loader2, ShieldCheck, TrendingUp, UserCircle } from "lucide-react";
import { type AssessmentResponse } from "@shared/routes";

// Form schema aligned with the backend insert schema
const formSchema = z.object({
  gender: z.enum(["Male", "Female", "Other"], { required_error: "Please select a gender" }),
  age: z.coerce.number().min(1, "Age must be greater than 0").max(120, "Age is too high"),
  hypertension: z.boolean().default(false),
  heartDisease: z.boolean().default(false),
  smokingHistory: z.enum(["never", "No Info", "current", "former", "ever", "not current"], { required_error: "Please select smoking history" }),
  bmi: z.coerce.number().min(10, "BMI must be between 10 and 60").max(60, "BMI must be between 10 and 60"),
  hba1cLevel: z.coerce.number().min(3, "HbA1c must be between 3 and 15").max(15, "HbA1c must be between 3 and 15"),
  bloodGlucoseLevel: z.coerce.number().min(50, "Blood glucose must be between 50 and 400").max(400, "Blood glucose must be between 50 and 400"),
});

type FormData = z.infer<typeof formSchema>;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#1E293B] placeholder-slate-400 shadow-sm outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const labelClass = "text-sm font-bold text-[#1E293B]";

const sectionHeadingClass =
  "flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-500";

const dashboardStats = [
  { label: "Assessment Speed", value: "2 min", icon: Clock3 },
  { label: "Model Status", value: "Ready", icon: ShieldCheck },
  { label: "Risk Signals", value: "7 inputs", icon: TrendingUp },
];

export default function Dashboard() {
  const [result, setResult] = useState<AssessmentResponse | null>(null);
  const { mutate: createAssessment, isPending, error } = useCreateAssessment();

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hypertension: false,
      heartDisease: false,
      smokingHistory: "never",
      gender: "Female",
      age: undefined,
      bmi: undefined,
      hba1cLevel: undefined,
      bloodGlucoseLevel: undefined
    }
  });

  const onSubmit = (data: FormData) => {
    createAssessment(data, {
      onSuccess: (data) => {
        setResult(data);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const isHypertension = watch("hypertension");
  const isHeartDisease = watch("heartDisease");

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]" />
              Clinical AI workspace
            </div>
            <h1 className="text-3xl md:text-5xl font-black font-display text-[#1E293B] tracking-tight">
              New Assessment
            </h1>
            <p className="text-slate-500 mt-3 text-lg max-w-2xl leading-8">
              Enter patient details to run the preventive diabetes and cardiovascular risk model.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[460px]">
            {dashboardStats.map((stat) => {
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
              <button 
                onClick={() => setResult(null)}
                className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Clear Result & Start Over
              </button>
            </div>
            <AssessmentResult assessment={result} />
          </div>
        )}

        <div className={`transition-all duration-500 ${result ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] transition-all duration-200 md:p-8 lg:p-10"
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
          {isPending && (
            <div className="mb-6 animate-pulse space-y-4">
            <div className="h-6 bg-slate-100 rounded w-1/3"></div>
            <div className="h-24 bg-slate-100 rounded-xl"></div>
            <div className="h-24 bg-slate-100 rounded-xl"></div>
           </div>
          )}
            <div className="grid grid-cols-1 gap-y-8 md:grid-cols-2 md:gap-x-12 md:gap-y-6">
              {/* Left Column: Demographics */}
              <div className="space-y-6">
                <h3 className={sectionHeadingClass}>
                  <UserCircle className="w-5 h-5 text-blue-600" /> Demographics
                </h3>
                
                <div className="space-y-2">
                  <label className={labelClass}>Gender</label>
                  <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
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
                  <label className={labelClass}>Age</label>
                  <input 
                    type="number" 
                    {...register("age")} 
                    className={inputClass}
                    placeholder="e.g. 45"
                  />
                  {errors.age && <p className="text-sm text-red-600 mt-1">{errors.age.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Smoking History</label>
                  <select 
                    {...register("smokingHistory")}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="never">never</option>
                    <option value="No Info">No Info</option>
                    <option value="current">current</option>
                    <option value="former">former</option>
                    <option value="ever">ever</option>
                    <option value="not current">not current</option>
                  </select>
                  {errors.smokingHistory && <p className="text-sm text-red-600 mt-1">{errors.smokingHistory.message}</p>}
                </div>
              </div>

              {/* Right Column: Medical History & Vitals */}
              <div className="space-y-6">
                <h3 className={sectionHeadingClass}>
                  <Activity className="w-5 h-5 text-blue-600" /> Vitals & History
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>BMI (kg/m²)</label>
                    <input 
                      type="number" step="0.1"
                      {...register("bmi")} 
                      className={inputClass}
                      placeholder="e.g. 25.0"
                    />
                    {errors.bmi && <p className="text-sm text-red-600 mt-1">{errors.bmi.message}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <label className={labelClass}>HbA1c Level (%)</label>
                    <input 
                      type="number" step="0.1"
                      {...register("hba1cLevel")} 
                      className={inputClass}
                      placeholder="e.g. 5.7"
                    />
                    {errors.hba1cLevel && <p className="text-sm text-red-600 mt-1">{errors.hba1cLevel.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Blood Glucose Level (mg/dL)</label>
                  <input 
                    type="number" 
                    {...register("bloodGlucoseLevel")} 
                    className={inputClass}
                    placeholder="e.g. 100"
                  />
                  {errors.bloodGlucoseLevel && <p className="text-sm text-red-600 mt-1">{errors.bloodGlucoseLevel.message}</p>}
                </div>

                <div className="space-y-4 pt-2">
                  <label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50/70 cursor-pointer transition-all duration-200 hover:border-blue-200 hover:bg-white hover:shadow-sm">
                    <div>
                      <p className="font-bold text-[#1E293B]">Hypertension</p>
                      <p className="text-xs text-slate-500">Diagnosed high blood pressure</p>
                    </div>
                    <div className={`relative h-7 w-14 shrink-0 rounded-full transition-all duration-200 ${isHypertension ? 'bg-blue-600 shadow-md shadow-blue-500/20' : 'bg-slate-300'}`}>
                      <input type="checkbox" {...register("hypertension")} className="sr-only" />
                      <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isHypertension ? 'translate-x-8' : 'translate-x-1'}`} />
                    </div>
                  </label>

                  <label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50/70 cursor-pointer transition-all duration-200 hover:border-blue-200 hover:bg-white hover:shadow-sm">
                    <div>
                      <p className="font-bold text-[#1E293B]">Heart Disease</p>
                      <p className="text-xs text-slate-500">Prior cardiovascular conditions</p>
                    </div>
                    <div className={`relative h-7 w-14 shrink-0 rounded-full transition-all duration-200 ${isHeartDisease ? 'bg-blue-600 shadow-md shadow-blue-500/20' : 'bg-slate-300'}`}>
                      <input type="checkbox" {...register("heartDisease")} className="sr-only" />
                      <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isHeartDisease ? 'translate-x-8' : 'translate-x-1'}`} />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-center text-xs italic text-slate-400">
                This tool is a prototype for decision support only. It does not provide a medical diagnosis. Always consult a healthcare professional.
              </p>
            </div>

            <div className="mt-10 border-t border-slate-100 pt-6 flex justify-end">
              <button
                type="submit"
                disabled={isPending || result !== null}
                className="w-full md:w-auto px-8 py-4 rounded-xl font-black text-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/10 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 flex items-center justify-center gap-2"
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
      </div>
    </AppLayout>
  );
}
