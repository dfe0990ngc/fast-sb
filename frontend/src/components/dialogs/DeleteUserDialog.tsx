import { memo } from "react";
import { User } from "../../types/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";

interface DeleteUserDialogProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onConfirm: () => void;
}

const DeleteUserDialog = memo(({
  open,
  onClose,
  user,
  onConfirm,
}: DeleteUserDialogProps) => {
  if (!user) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the user <strong className="text-foreground">{user?.FirstName} {user?.LastName}</strong> ({user?.UserID}). This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700 focus:ring-red-600" onClick={onConfirm}>
            Delete User
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

export default DeleteUserDialog;