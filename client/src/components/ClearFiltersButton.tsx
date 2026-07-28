import React from 'react';
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

interface ClearFiltersButtonProps {
  onClear: () => void;
  disabled?: boolean;
}

export function ClearFiltersButton({ onClear, disabled }: ClearFiltersButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClear}
      disabled={disabled}
      className="gap-2"
    >
      <RotateCw className="h-4 w-4" />
      Clear filters
    </Button>
  );
}

