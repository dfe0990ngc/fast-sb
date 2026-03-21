import { useEffect, useState, memo } from "react";
import { Make } from "../../types/types";
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
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";

const DEFAULT_FORM_DATA: Partial<Make> = { Name: "", Description: "", IsActive: true };

interface MakeFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Make>) => void;
  make: Make | null;
  mode: "create" | "edit";
}

const useMakeForm = (make: Make | null, mode: "create" | "edit") => {
  const [formData, setFormData] = useState<Partial<Make>>(DEFAULT_FORM_DATA);
  
  useEffect(() => {
    if (make && mode === "edit") {
      setFormData(make);
    } else if (mode === "create") {
      setFormData(DEFAULT_FORM_DATA);
    }
  }, [make, mode]);

  const handleChange = (field: keyof Make, value: string | boolean, setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>) => {
    setFormData((prev) => ({ ...prev, [field]: typeof value === 'string' ? value.trimStart() : value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return { formData, handleChange };
};

const MakeFormDialog = memo(({
  open,
  onClose,
  onSave,
  make,
  mode,
}: MakeFormDialogProps) => {
  const { formData, handleChange: handleFormChange } = useMakeForm(make, mode);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof Make, value: string | boolean) => {
    handleFormChange(field, value, setErrors);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.Name?.trim()) newErrors.Name = "Make name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onSave(formData);
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
            <DialogTitle>
              {mode === "create" ? "Create New Make" : "Edit Make"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Add a new vehicle brand to the system."
                : "Modify an existing vehicle brand."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-3 sm:p-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                Make Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Toyota, Honda, Isuzu"
                value={formData.Name || ""}
                onChange={(e) => handleChange("Name", e.target.value)}
                className={errors.Name ? "border-red-500" : ""}
              />
              {errors.Name && (
                <p className="text-red-500 text-sm">{errors.Name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional: A brief description of the make"
                value={formData.Description || ""}
                onChange={(e) => handleChange("Description", e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is-active"
                checked={!!formData.IsActive}
                onCheckedChange={(checked) => handleChange("IsActive", checked)}
              />
              <Label htmlFor="is-active">Set as active</Label>
            </div>
          </div>

          <DialogFooter className="flex sm:flex-row flex-col justify-end gap-2 bg-slate-50 p-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#008ea2] hover:bg-[#007a8b]"
            >
              {mode === "create" ? "Create Make" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}); 

export default MakeFormDialog;
