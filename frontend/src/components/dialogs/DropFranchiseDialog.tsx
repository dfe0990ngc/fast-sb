import { useState, useEffect } from 'react';
import { Franchise } from '../../types/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import * as api from '../../api/api';
import { useAuth } from '../../context/AuthContext';

interface DropFranchiseDialogProps {
  open: boolean;
  onClose: () => void;
  franchise: Franchise | null;
  onSuccess: () => void;
}

const DropFranchiseDialog = ({ open, onClose, franchise, onSuccess }: DropFranchiseDialogProps) => {
  const [dropReason, setDropReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      setDropReason('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!franchise || !user) return;

    setIsSubmitting(true);
    try {
      await api.post(`/api/franchises/${franchise.id}/drop`, {
        DropReason: dropReason,
        userId: user.id
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to drop franchise:", error);
      // You might want to add user-facing error handling here
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}>
        <DialogHeader className="px-3 sm:px-6 pt-6">
          <DialogTitle>Drop Franchise</DialogTitle>
          <DialogDescription>Provide a reason for dropping this franchise. This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}className="space-y-4 p-3 sm:p-6 max-h-[calc(90vh-8rem)] overflow-y-auto">
          <div className="gap-4 grid py-4">
            <Label htmlFor="dropReason">Drop Reason</Label>
            <Textarea id="dropReason" value={dropReason} onChange={(e) => setDropReason(e.target.value)} required />
          </div>
          <DialogFooter className="bottom-0 sticky flex sm:flex-row flex-col justify-end gap-2 bg-white p-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>{isSubmitting ? 'Dropping...' : 'Drop Franchise'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DropFranchiseDialog;