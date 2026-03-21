import { useEffect, useState, memo } from "react";
import { Applicant } from "../../types/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

const DEFAULT_FORM_DATA: Partial<Applicant> = {
  FirstName: "",
  LastName: "",
  MiddleName: "",
  Address: "",
  ContactNo: "",
};

interface ApplicantFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Applicant>) => void;
  applicant: Applicant | null;
  mode: "create" | "edit";
  initialName?: string;
}

const ApplicantFormDialog = memo(({ open, onClose, onSave, applicant, mode, initialName }: ApplicantFormDialogProps) => {
  const [formData, setFormData] = useState<Partial<Applicant>>(DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (applicant && mode === "edit") {
        setFormData(applicant);
      } else if (mode === 'create' && initialName) {
        const nameParts = initialName?.split(' ');
        setFormData({
            ...DEFAULT_FORM_DATA,
            FirstName: nameParts[0] || '',
            LastName: nameParts.slice(1).join(' ') || '',
        });
      } else {
        setFormData(DEFAULT_FORM_DATA);
      }
      setErrors({});
    }
  }, [open, applicant, mode, initialName]);

  const handleChange = (field: keyof Applicant, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.FirstName?.trim()) newErrors.FirstName = "First name is required";
    if (!formData.LastName?.trim()) newErrors.LastName = "Last name is required";
    if (!formData.Address?.trim()) newErrors.Address = "Address is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}>
        <form onSubmit={handleFormSubmit}>
          <DialogHeader className="px-3 sm:px-6 pt-6">
            <DialogTitle>{mode === "create" ? "Create New Applicant" : "Edit Applicant"}</DialogTitle>
            <DialogDescription>
              {mode === "create" ? "Add a new applicant to the system." : "Modify existing applicant details."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-3 sm:p-6 max-h-[calc(90vh-8rem)] overflow-y-auto">
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="first-name">First Name <span className="text-red-500">*</span></Label><Input id="first-name" value={formData.FirstName || ""} onChange={(e) => handleChange("FirstName", e.target.value)} className={errors.FirstName ? "border-red-500" : ""} />{errors.FirstName && <p className="text-red-500 text-sm">{errors.FirstName}</p>}</div>
              <div className="space-y-2"><Label htmlFor="last-name">Last Name <span className="text-red-500">*</span></Label><Input id="last-name" value={formData.LastName || ""} onChange={(e) => handleChange("LastName", e.target.value)} className={errors.LastName ? "border-red-500" : ""} />{errors.LastName && <p className="text-red-500 text-sm">{errors.LastName}</p>}</div>
            </div>
            
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="middle-name">Middle Name</Label><Input id="middle-name" value={formData.MiddleName || ""} onChange={(e) => handleChange("MiddleName", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="contact-no">Contact Number</Label><Input id="contact-no" value={formData.ContactNo || ""} onChange={(e) => handleChange("ContactNo", e.target.value)} /></div>
            </div>

            <div className="space-y-2"><Label htmlFor="address">Address <span className="text-red-500">*</span></Label><Input id="address" value={formData.Address || ""} onChange={(e) => handleChange("Address", e.target.value)} className={errors.Address ? "border-red-500" : ""} />{errors.Address && <p className="text-red-500 text-sm">{errors.Address}</p>}</div>

          </div>

          <DialogFooter className="bottom-0 sticky flex sm:flex-row flex-col justify-end gap-2 bg-white p-6 border-t"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" className="bg-[#008ea2] hover:bg-[#007a8b]">{mode === "create" ? "Create Applicant" : "Save Changes"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

export default ApplicantFormDialog;