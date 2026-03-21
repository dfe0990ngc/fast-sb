import { memo } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Applicant } from "../../types/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";

interface DeleteApplicantDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  applicant: Applicant | null;
}

const DeleteApplicantDialog = memo(({ open, onClose, onConfirm, applicant }: DeleteApplicantDialogProps) => {
  if (!applicant) return null;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Applicant?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the applicant "{applicant.FirstName} {applicant.LastName}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            onClick={onConfirm}
          >Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

export default DeleteApplicantDialog;