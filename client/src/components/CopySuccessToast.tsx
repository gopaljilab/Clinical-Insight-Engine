import React from 'react';
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface CopySuccessToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function CopySuccessToast({
  title = "Summary copied",
  description = "Assessment summary has been copied to your clipboard.",
  variant = "default",
}: CopySuccessToastProps) {
  const { toast } = useToast();

  useEffect(() => {
    toast({
      title,
      description,
      variant,
    });
  }, [toast, title, description, variant]);

  return null;
}

