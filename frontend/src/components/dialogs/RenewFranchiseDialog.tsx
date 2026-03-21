import { useState, useEffect } from 'react';
import { Franchise, FranchiseRenewal } from '../../types/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import * as api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { lpad } from '../../lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface RenewFranchiseDialogProps {
  open: boolean;
  onClose: () => void;
  franchise: Franchise | null;
  onSuccess: () => void;
}

const RenewFranchiseDialog = ({ open, onClose, franchise, onSuccess }: RenewFranchiseDialogProps) => {
  const initialFormData: Omit<FranchiseRenewal, 'userId'> = {
    ExpiryDate: '',
    ORNo: '',
    Amount: 0,
    LastRenewalDate: new Date().toISOString().split('T')[0],
    Route: franchise?.Route || '',
  };
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState<Partial<typeof initialFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (open && franchise) {
      setFormData({
        ExpiryDate: '', // Reset expiry date for new renewal
        ORNo: '',
        Amount: 0,
        LastRenewalDate: new Date().toISOString().split('T')[0],
        Route: franchise.Route,
      });
      setErrors({}); // Clear previous errors
    }
  }, [open, franchise]);

  useEffect(() => {
    if(formData.LastRenewalDate){
      const ds = new Date(formData.LastRenewalDate);
      if(ds){
        const y = ds.getFullYear()+5;
        const m = ds.getMonth()+1;
        const d = ds.getDate();
        const xp = y+'-'+lpad(m)+'-'+lpad(d);
        
        setFormData((prev) => ({...prev, ExpiryDate: xp}));
      }
    }
  },[formData.LastRenewalDate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    const newErrors: Partial<typeof initialFormData> = {};
    if (!formData.LastRenewalDate) newErrors.LastRenewalDate = "Last renewal date is required.";
    if (!formData.ExpiryDate) newErrors.ExpiryDate = "Expiry date is required.";
    if (formData.LastRenewalDate && formData.ExpiryDate && formData.ExpiryDate <= formData.LastRenewalDate) {
      newErrors.ExpiryDate = "Expiry date must be after the renewal date.";
    }
    if (!formData.ORNo.trim()) newErrors.ORNo = "OR Number is required.";
    if (!formData.Amount) {
      newErrors.Amount = "Amount is required.";
    } else if (isNaN(Number(formData.Amount)) || Number(formData.Amount) <= 0) {
      newErrors.Amount = "Please enter a valid amount.";
    }

    if(!formData.Route.trim()) newErrors.Route = "The route is required.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!franchise || !user) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/api/franchises/${franchise.id}/renew`, {
        ...formData,
        Amount: Number(formData.Amount),
        userId: user.id,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to renew franchise:", error);
      // You might want to add user-facing error handling here (e.g., a toast notification)
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="px-3 sm:px-6 pt-6">
          <DialogTitle>Renew Franchise</DialogTitle>
          <DialogDescription>Update the franchise details for renewal.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4 p-3 sm:p-6 max-h-[calc(90vh-8rem)] overflow-y-auto">
          <div className="gap-4 grid py-4">
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="LastRenewalDate">Last Renewal Date <span className="text-red-500">*</span></Label>
                <Input id="LastRenewalDate" name="LastRenewalDate" type="date" value={formData.LastRenewalDate} onChange={handleChange} className={errors.LastRenewalDate ? "border-red-500" : ""} />
                {errors.LastRenewalDate && <p className="mt-1 text-red-500 text-sm">{errors.LastRenewalDate}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ExpiryDate">New Expiry Date <span className="text-red-500">*</span></Label>
                <Input id="ExpiryDate" name="ExpiryDate" type="date" value={formData.ExpiryDate} onChange={handleChange} className={errors.ExpiryDate ? "border-red-500" : ""} />
                {errors.ExpiryDate && <p className="mt-1 text-red-500 text-sm">{errors.ExpiryDate}</p>}
              </div>
            </div>
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ORNo">OR Number <span className="text-red-500">*</span></Label>
                <Input id="ORNo" name="ORNo" value={formData.ORNo} onChange={handleChange} className={errors.ORNo ? "border-red-500" : ""} />
                {errors.ORNo && <p className="mt-1 text-red-500 text-sm">{errors.ORNo}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="Amount">Amount Paid <span className="text-red-500">*</span></Label>
                <Input id="Amount" name="Amount" type="number" step="0.01" value={formData.Amount} onChange={handleChange} className={errors.Amount ? "border-red-500" : ""} />
                {errors.Amount && <p className="mt-1 text-red-500 text-sm">{errors.Amount}</p>}
              </div>
            </div>
            {/* Route */}
            <div className="space-y-2">
              <Label htmlFor="route">
                Route <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.Route || ""}
                onValueChange={(value) => setFormData({ ...formData, ['Route']: value })}
              >
                <SelectTrigger id="route" className={errors.Route ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select Route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="North Bound">North Bound</SelectItem>
                  <SelectItem value="South Bound">South Bound</SelectItem>
                  <SelectItem value="Junction">Junction</SelectItem>
                </SelectContent>
              </Select>
              {errors.Route && (
                <p className="text-red-500 text-sm">{errors.Route}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-[#008ea2] hover:bg-[#007a8b]" disabled={isSubmitting}>
              {isSubmitting ? 'Renewing...' : 'Renew Franchise'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RenewFranchiseDialog;