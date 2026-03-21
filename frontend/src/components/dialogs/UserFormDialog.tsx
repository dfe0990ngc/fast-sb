import { useEffect, useState, memo } from "react";
import { User } from "../../types/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";

const DEFAULT_FORM_DATA: Partial<User> = { UserID: "", FirstName: "", LastName: "", UserType: "Viewer", Password: "" };

interface UserFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<User>) => void;
  user: User | null;
  mode: "create" | "edit";
}

const useUserForm = (setFormData: React.Dispatch<React.SetStateAction<Partial<User>>>) => {
  const handleChange = (field: keyof User, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  return { handleChange };
};

const UserFormDialog = memo(({
  open,
  onClose,
  onSave,
  user,
  mode,
}: UserFormDialogProps) => {
  const [formData, setFormData] = useState<Partial<User>>(DEFAULT_FORM_DATA);
  const { handleChange: handleFormChange } = useUserForm(setFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (user && mode === 'edit') {
        setFormData({ ...user, Password: "" }); // Clear password on edit
      } else {
        setFormData(DEFAULT_FORM_DATA);
      }
      setErrors({});
    }
  }, [open]);

  const handleChange = (field: keyof User, value: string) => {
    handleFormChange(field, value);
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.UserID?.trim()) newErrors.UserID = "Username is required";
    if (!formData.FirstName?.trim()) newErrors.FirstName = "First name is required";
    if (!formData.LastName?.trim()) newErrors.LastName = "Last name is required";
    if (!formData.UserType) newErrors.UserType = "User role is required";

    if (mode === "create" && !formData.Password) {
      newErrors.Password = "Password is required for new users";
    }
    if (formData.Password && formData.Password.length < 6) {
      newErrors.Password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
        const dataToSave = { ...formData };
        // Don't send empty password on update unless it's being changed
        if (mode === 'edit' && !dataToSave.Password) {
            delete dataToSave.Password;
        }
        onSave(dataToSave);
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <form onSubmit={handleFormSubmit}>
          <DialogHeader className="px-3 sm:px-6 pt-6">
            <DialogTitle>{mode === "create" ? "Create New User" : "Edit User"}</DialogTitle>
            <DialogDescription>
              {mode === "create" ? "Add a new user to the system." : "Modify an existing user's details."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-3 sm:p-6">
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                <Input id="firstName" value={formData.FirstName || ""} onChange={(e) => handleChange("FirstName", e.target.value)} className={errors.FirstName ? "border-red-500" : ""} />
                {errors.FirstName && <p className="text-red-500 text-sm">{errors.FirstName}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
                <Input id="lastName" value={formData.LastName || ""} onChange={(e) => handleChange("LastName", e.target.value)} className={errors.LastName ? "border-red-500" : ""} />
                {errors.LastName && <p className="text-red-500 text-sm">{errors.LastName}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userID">Username (UserID) <span className="text-red-500">*</span></Label>
              <Input id="userID" value={formData.UserID || ""} onChange={(e) => handleChange("UserID", e.target.value)} disabled={mode === 'edit'} className={errors.UserID ? "border-red-500" : ""} />
              {errors.UserID && <p className="text-red-500 text-sm">{errors.UserID}</p>}
            </div>

            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Password {mode === 'create' && <span className="text-red-500">*</span>}</Label>
                <Input id="password" type="password" placeholder={mode === 'edit' ? "Leave blank to keep current" : ""} onChange={(e) => handleChange("Password", e.target.value)} className={errors.Password ? "border-red-500" : ""} />
                {errors.Password && <p className="text-red-500 text-sm">{errors.Password}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="userType">Role <span className="text-red-500">*</span></Label>
                <Select value={formData.UserType || "Viewer"} onValueChange={(value) => handleChange("UserType", value)}>
                  <SelectTrigger id="userType" className={errors.UserType ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Editor">Editor</SelectItem>
                    <SelectItem value="Viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                {errors.UserType && <p className="text-red-500 text-sm">{errors.UserType}</p>}
              </div>
            </div>
          </div>

          <DialogFooter className="flex sm:flex-row flex-col justify-end gap-2 bg-slate-50 p-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-[#008ea2] hover:bg-[#007a8b]">
              {mode === "create" ? "Create User" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

export default UserFormDialog;