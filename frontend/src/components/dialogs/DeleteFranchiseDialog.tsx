import { memo } from "react";
import { Franchise } from "../../types/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";

interface DeleteFranchiseDialogProps {
  open: boolean;
  onClose: () => void;
  franchise: Franchise | null;
  onConfirm: () => void;
}

const DeleteFranchiseDialog = memo(({
  open,
  onClose,
  franchise,
  onConfirm,
}: DeleteFranchiseDialogProps) => {
  if (!franchise) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the franchise for <strong className="text-foreground">{franchise.Name}</strong>{' '}
            ({franchise.FranchiseNo}). This action cannot be undone and will remove all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            onClick={onConfirm}
          >
            Delete Franchise
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

export default DeleteFranchiseDialog;