import React, { useState } from "react";
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [open, setOpen] = useState(false);

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
            Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Assessment</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the assessment for{" "}
            <strong>{patientName}</strong> from <strong>{assessmentDate}</strong>?
            This action cannot be undone and will permanently remove this data
            from the system.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            isLoading={isDeleting}
            loadingText="Deleting..."
            className="gap-2"
          >
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
