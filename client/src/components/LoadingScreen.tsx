import React from 'react';
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground animate-in fade-in duration-500">
        <div className="rounded-full bg-primary/10 p-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <p className="text-sm font-medium tracking-tight text-primary/80">
          {t("common.loading", "Loading Engine...")}
        </p>
      </div>
    </div>
  );
}

