import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, CartesianGrid } from "recharts";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ShapValue {
  name: string;
  value: number;
}

interface ShapWaterfallChartProps {
  shapValues?: ShapValue[];
}

export function ShapWaterfallChart({ shapValues }: ShapWaterfallChartProps) {
  const { t } = useTranslation();

  if (!shapValues || shapValues.length === 0) {
    return null;
  }

  // Find max absolute value to ensure symmetric X-axis
  const maxAbs = Math.max(...shapValues.map((v) => Math.abs(v.value)));
  const domain = [-maxAbs * 1.1, maxAbs * 1.1];

  return (
    <div className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm mt-6">
      <div className="flex flex-col gap-2 mb-5">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" /> SHAP Feature Explanations
        </h3>
        <p className="text-sm text-muted-foreground">
          Visualizing exactly how much each clinical feature pushed the risk score up (red) or down (green).
        </p>
      </div>

      <div className="h-[300px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={shapValues}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={domain} hide />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={120} 
              tick={{ fontSize: 12, fill: "currentColor" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "transparent" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as ShapValue;
                  const isPositive = data.value > 0;
                  return (
                    <div className="bg-background border border-border shadow-md rounded-lg p-3 text-sm">
                      <p className="font-semibold mb-1">{data.name}</p>
                      <p className={isPositive ? "text-red-500" : "text-green-500"}>
                        {isPositive ? "Increases risk by: " : "Reduces risk by: "}
                        {Math.abs(data.value).toFixed(3)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine x={0} stroke="currentColor" strokeOpacity={0.3} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
              {shapValues.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.value > 0 ? "rgb(239, 68, 68)" : "rgb(34, 197, 94)"} 
                  className={entry.value > 0 ? "fill-red-500" : "fill-green-500"}
                  radius={entry.value > 0 ? [0, 4, 4, 0] : [4, 0, 0, 4]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
