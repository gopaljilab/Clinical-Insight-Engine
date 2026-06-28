import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
interface BMIClassificationHelperProps {
  bmi: number | undefined;
}

interface BMICategory {
  label: string;
  range: string;
  icon: React.ReactNode;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  containerClass: string;
  textClass: string;
}

const BMI_CATEGORIES: Record<string, BMICategory> = {
  underweight: {
    label: "Underweight",
    range: "BMI < 18.5",
    icon: <Info className="w-5 h-5" />,
    badgeVariant: "default",
    containerClass: "bg-blue-50 border border-blue-200",
    textClass: "text-blue-700",
  },
  healthy: {
    label: "Healthy Weight",
    range: "BMI 18.5 - 24.9",
    icon: <CheckCircle2 className="w-5 h-5" />,
    badgeVariant: "secondary",
    containerClass: "bg-green-50 border border-green-200",
    textClass: "text-green-700",
  },
  overweight: {
    label: "Overweight",
    range: "BMI 25.0 - 29.9",
    icon: <AlertTriangle className="w-5 h-5" />,
    badgeVariant: "default",
    containerClass: "bg-amber-50 border border-amber-200",
    textClass: "text-amber-700",
  },
  obese: {
    label: "Obese",
    range: "BMI ≥ 30.0",
    icon: <AlertCircle className="w-5 h-5" />,
    badgeVariant: "destructive",
    containerClass: "bg-red-50 border border-red-200",
    textClass: "text-red-700",
  },
};

function getCategory(bmi: number): string {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "healthy";
  if (bmi < 30) return "overweight";
  return "obese";
}

export function BMIClassificationHelper({
  bmi,
}: BMIClassificationHelperProps) {
  const numericBmi = Number(bmi);
  if (isNaN(numericBmi) || bmi === undefined || bmi === null) {
    return null;
  }

  const categoryKey = getCategory(numericBmi);
  const category = BMI_CATEGORIES[categoryKey];

  if (!category) {
    return null;
  }

  return (
    <div
      className={cn("mt-3 p-4 rounded-xl flex items-start gap-3 transition-all duration-200", category.containerClass)}
    >
      <div className={cn("shrink-0", category.textClass)}>
        {category.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <p className={cn("font-semibold text-sm", category.textClass)}>
            Category: {category.label}
          </p>
          <Badge
            variant={category.badgeVariant}
            className="text-xs whitespace-nowrap"
          >
            {numericBmi.toFixed(1)}
          </Badge>
        </div>
        <p className={cn("text-xs opacity-90", category.textClass)}>
          <span className="font-medium">Healthy BMI Range:</span> 18.5 – 24.9
        </p>
      </div>
    </div>
  );
}
