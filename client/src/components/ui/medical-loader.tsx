import React from "react";
import { cn } from "@/lib/utils";
import "./medical-loader.css";

export type MedicalLoaderType = "heartbeat" | "cross" | "dna";

export interface MedicalLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: MedicalLoaderType;
  size?: "sm" | "md" | "lg" | "xl";
}

export function MedicalLoader({
  type = "cross",
  size = "md",
  className,
  ...props
}: MedicalLoaderProps) {
  const sizeClasses = {
    sm: "scale-75",
    md: "scale-100",
    lg: "scale-125",
    xl: "scale-150",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center text-primary",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {type === "heartbeat" && (
        <div className="medical-loader-heartbeat">
          <div></div>
        </div>
      )}
      {type === "cross" && <div className="medical-loader-cross"></div>}
      {type === "dna" && (
        <div className="medical-loader-dna">
          <div className="medical-loader-dna-dot"></div>
          <div className="medical-loader-dna-dot"></div>
        </div>
      )}
    </div>
  );
}
