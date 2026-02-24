import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { AssessmentResult } from "@/components/AssessmentResult";
import { useCreateAssessment } from "@/hooks/use-assessments";
import { Activity, Loader2, AlertCircle } from "lucide-react";
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  const isHypertension = watch("hypertension");
  const isHeartDisease = watch("heartDisease");

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black font-display text-foreground tracking-tight">
            New Assessment
          </h1>
          <p className="text-muted-foreground mt-2 text-lg max-w-2xl">
            Enter patient details to run the preventive diabetes and cardiovascular risk model.
          </p>
        </div>

        {result && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Assessment Complete</h2>
              <button 
                onClick={() => setResult(null)}
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Clear Result & Start Over
              </button>
            </div>
            <AssessmentResult assessment={result} />
          </div>
        )}

        <div className={`transition-all duration-500 ${result ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
          <form onSubmit={handleSubmit(onSubmit)} className="bg-card rounded-2xl shadow-lg shadow-black/5 border border-border/60 p-6 md:p-8">
            
            {error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3 text-destructive">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Assessment Failed</p>
                  <p className="text-sm opacity-90">{error.message}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Demographics */}
              <div className="space-y-6">
                <h3 className="font-bold text-lg border-b border-border/50 pb-2 flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-primary" /> Demographics
                </h3>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Gender</label>
                  <div className="flex gap-3">
                    {["Male", "Female", "Other"].map((g) => (
                      <label key={g} className="flex-1 cursor-pointer">
                        <input type="radio" value={g} {...register("gender")} className="peer sr-only" />
                        <div className="text-center px-4 py-3 rounded-xl border-2 border-border bg-background peer-checked:border-primary peer-checked:bg-primary/5 hover:border-primary/50 transition-all font-medium text-sm text-muted-foreground peer-checked:text-primary">
                          {g}
                        </div>
                      </label>
                    ))}
                  </div>
                  {errors.gender && <p className="text-sm text-destructive mt-1">{errors.gender.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Age</label>
                  <input 
                    type="number" 
                    {...register("age")} 
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-foreground"
                    placeholder="e.g. 45"
                  />
                  {errors.age && <p className="text-sm text-destructive mt-1">{errors.age.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Smoking History</label>
                  <select 
                    {...register("smokingHistory")}
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-foreground appearance-none"
                  >
                    <option value="never">never</option>
                    <option value="No Info">No Info</option>
                    <option value="current">current</option>
                    <option value="former">former</option>
                    <option value="ever">ever</option>
                    <option value="not current">not current</option>
                  </select>
                  {errors.smokingHistory && <p className="text-sm text-destructive mt-1">{errors.smokingHistory.message}</p>}
                </div>
              </div>

              {/* Right Column: Medical History & Vitals */}
              <div className="space-y-6">
                <h3 className="font-bold text-lg border-b border-border/50 pb-2 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" /> Vitals & History
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">BMI (kg/m²)</label>
                    <input 
                      type="number" step="0.1"
                      {...register("bmi")} 
                      className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                      placeholder="e.g. 25.0"
                    />
                    {errors.bmi && <p className="text-sm text-destructive mt-1">{errors.bmi.message}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">HbA1c Level (%)</label>
                    <input 
                      type="number" step="0.1"
                      {...register("hba1cLevel")} 
                      className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                      placeholder="e.g. 5.7"
                    />
                    {errors.hba1cLevel && <p className="text-sm text-destructive mt-1">{errors.hba1cLevel.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Blood Glucose Level (mg/dL)</label>
                  <input 
                    type="number" 
                    {...register("bloodGlucoseLevel")} 
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    placeholder="e.g. 100"
                  />
                  {errors.bloodGlucoseLevel && <p className="text-sm text-destructive mt-1">{errors.bloodGlucoseLevel.message}</p>}
                </div>

                <div className="space-y-4 pt-2">
                  <label className="flex items-center justify-between p-4 rounded-xl border-2 border-border bg-background cursor-pointer hover:border-primary/50 transition-colors">
                    <div>
                      <p className="font-semibold text-foreground">Hypertension</p>
                      <p className="text-xs text-muted-foreground">Diagnosed high blood pressure</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full transition-colors relative ${isHypertension ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                      <input type="checkbox" {...register("hypertension")} className="sr-only" />
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isHypertension ? 'translate-x-7' : 'translate-x-1'}`} />
                    </div>
                  </label>

                  <label className="flex items-center justify-between p-4 rounded-xl border-2 border-border bg-background cursor-pointer hover:border-primary/50 transition-colors">
                    <div>
                      <p className="font-semibold text-foreground">Heart Disease</p>
                      <p className="text-xs text-muted-foreground">Prior cardiovascular conditions</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full transition-colors relative ${isHeartDisease ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                      <input type="checkbox" {...register("heartDisease")} className="sr-only" />
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isHeartDisease ? 'translate-x-7' : 'translate-x-1'}`} />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted/30 rounded-xl border border-border/50">
              <p className="text-xs text-muted-foreground text-center italic">
                This tool is a prototype for decision support only. It does not provide a medical diagnosis. Always consult a healthcare professional.
              </p>
            </div>

            <div className="mt-10 border-t border-border/50 pt-6 flex justify-end">
              <button
                type="submit"
                disabled={isPending || result !== null}
                className="w-full md:w-auto px-8 py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-primary to-blue-500 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 flex items-center justify-center gap-2"
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

// Ensure icons used in file are imported:
import { UserCircle } from "lucide-react";
