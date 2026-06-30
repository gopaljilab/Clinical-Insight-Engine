import React, { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface ConfirmDeleteDialogProps {
  patientName: string;
  assessmentDate: string;
  onConfirm: () => Promise<void>;
  trigger?: React.ReactNode;
}

export function ConfirmDeleteDialog({
  patientName,
  assessmentDate,
  onConfirm,
  trigger,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useFocusTrap(contentRef, open, () => setOpen(false));

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDeleting(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      // Error handling is expected to be managed by the parent (e.g., via toast)
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" size="sm" className="gap-2">
            <Trash2 className="h-4 w-4" />
            {t("common.delete")}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent ref={contentRef}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("assessment.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("assessment.deleteConfirm", { patientName, assessmentDate })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            isLoading={isDeleting}
            loadingText={t("assessment.deleting")}
            className="gap-2"
          >
            {t("common.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
