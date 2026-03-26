import { useEffect, useState, memo, useCallback } from "react";
import { Franchise, Make, Applicant } from "../../types/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import * as api from '../../api/api.js';
 
const DEFAULT_FORM_DATA: Partial<Franchise> = {
  Name: "",
  Address: "",
  ContactNo: "",
  FranchiseNo: "",
  DateIssued: new Date().toISOString().split("T")[0],
  ExpiryDate: "",
  Route: "",
  MakeID: "",
  ChassisNo: "",
  EngineNo: "",
  PlateNo: "",
  ORNo: "",
  Amount: "",
  Status: "new",
  ApplicantID: null,
  ApplicantName: "",
  LastRenewalDate: "",
  DropReason: "",
};

// Use the new ApplicantFormDialog
import ApplicantFormDialog from "./ApplicantFormDialog";
import { toast } from "sonner";

interface FranchiseFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Franchise>) => void;
  searchApplicants: (searchTerm: string) => Promise<Applicant[]>;
  franchise: Franchise | null;
  makes: Make[];
  mode: "create" | "edit";
}

const useFranchiseForm = (franchise: Franchise | null, mode: "create" | "edit") => {
  const [formData, setFormData] = useState<Partial<Franchise>>(DEFAULT_FORM_DATA);
  
  useEffect(() => {
    if (franchise && mode === "edit") {
      setFormData(franchise);
    } else if (mode === "create") {
      setFormData(DEFAULT_FORM_DATA);
    }
  }, [franchise, mode]);

  const handleChange = useCallback((field: keyof Franchise, value: string, setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>) => {
    setFormData((prev) => ({ ...prev, [field]: value.trimStart() }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }, []);

  return { formData, handleChange, setFormData };
};

const FranchiseFormDialog = memo(({
  open,
  onClose,
  onSave,
  searchApplicants,
  franchise,
  makes,
  mode,
}: FranchiseFormDialogProps) => {
  const { formData, handleChange: handleFormChange, setFormData } = useFranchiseForm(franchise, mode);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [openApplicant, setOpenApplicant] = useState(false);
  const [applicantSearch, setApplicantSearch] = useState("");
  const debouncedSearch = useDebounce(applicantSearch, 500);
  const [searchedApplicants, setSearchedApplicants] = useState<Applicant[]>([]);
  const [isApplicantCreateFormOpen, setIsApplicantCreateFormOpen] = useState(false);
  const [applicantNameToCreate, setApplicantNameToCreate] = useState('');

  // New states for fetching applicant details
  const [loadingStates, setLoadingStates] = useState({
    applicantSearch: false,
    applicantDetails: false,
  });

  useEffect(() => {
    if (open) {
      setErrors({}); // Clear errors on open
      if (mode === 'edit' && franchise && franchise.ApplicantID) {
        handleFormChange('ApplicantName', `${franchise.ApplicantName}`, setErrors);
        handleFormChange('ContactNo', franchise.ContactNo || '', setErrors);
        handleFormChange('Address', franchise.Address || '', setErrors);
      } else if (mode === 'create') {
        // Reset form for create mode
        setFormData(DEFAULT_FORM_DATA);
      }
    }
  }, [open, mode, franchise, handleFormChange, setFormData]);

  // Set default last renewal date when status is renew
  // useEffect(() => {
  //   if(formData.Status === 'renew' && (!formData.LastRenewalDate || formData.LastRenewalDate === '0000-00-00')){
  //     const dt = new Date();
  //     // Directly call handleFormChange since it's stable now
  //     handleFormChange('LastRenewalDate', dt.toISOString().split("T")[0], setErrors);
  //   }
  // },[formData.Status, formData.LastRenewalDate, handleFormChange]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.FranchiseNo?.trim()) newErrors.FranchiseNo = "Franchise number is required";
    if (!formData.DateIssued) newErrors.DateIssued = "Date issued is required";
    if (!formData.Route?.trim()) newErrors.Route = "Route is required";
    if (!formData.MakeID) newErrors.MakeID = "Make is required";
    if (!formData.ChassisNo?.trim()) newErrors.ChassisNo = "Chassis number is required";
    if (!formData.EngineNo?.trim()) newErrors.EngineNo = "Engine number is required";
    if (!formData.PlateNo?.trim()) newErrors.PlateNo = "Plate number is required";

    if (formData.Status === 'renew' && !formData.ExpiryDate) {
      newErrors.ExpiryDate = 'Expiry date is required for renewal';
    }

    // if (mode === 'create' && formData.Status === 'renew' && !formData.LastRenewalDate) {
    //   newErrors.LastRenewalDate = 'Last renewal date is required';
    // }

    if (formData.ExpiryDate && formData.DateIssued) {
      const issued = new Date(formData.DateIssued);
      const expiry = new Date(formData.ExpiryDate);
      if (expiry < issued)
        newErrors.ExpiryDate = "Expiry date must be after date issued";
    }

    // if (formData.LastRenewalDate && formData.DateIssued) {
    //   const issued = new Date(formData.DateIssued);
    //   const lrd = new Date(formData.LastRenewalDate);
    //   if (lrd < issued)
    //     newErrors.LastRenewalDate = "Last Renewal date must be after date issued";
    // }

    // if (formData.LastRenewalDate && formData.ExpiryDate) {
    //   const exp = new Date(formData.ExpiryDate);
    //   const lrd = new Date(formData.LastRenewalDate);
    //   if (lrd >= exp)
    //     newErrors.LastRenewalDate = "Last Renewal date must less than expire date";
    // }

    if (formData.Status === "drop" && !formData.DropReason?.trim()) {
      newErrors.DropReason = 'Drop reason is required when status is "drop"';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, mode]);

  const handleSubmit = useCallback(() => {
    if (validate()) onSave(formData);
  }, [validate, onSave, formData]);

  useEffect(() => {
    const loadApplicants = async () => {
      setLoadingStates(prev => ({ ...prev, applicantSearch: true }));
      if (debouncedSearch) {
        const results = await searchApplicants(debouncedSearch);
        setSearchedApplicants(results);
      } else {
        setSearchedApplicants([]);
      }
      setLoadingStates(prev => ({ ...prev, applicantSearch: false }));
    };
    loadApplicants();
  }, [debouncedSearch, searchApplicants]);
  const handleFormSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit();
  }, [handleSubmit]);

  const handleApplicantCreate = useCallback((name: string) => {
    setApplicantNameToCreate(name);
    setIsApplicantCreateFormOpen(true);
    setOpenApplicant(false); // Close the applicant search popover
  }, []);

  

  const handleApplicantCreateSuccess = useCallback(async (data: Partial<Applicant>) => {
    try {
      const response = await api.post('/api/applicants', data);
      
      if (response.data.success) {
        const newApplicant = response.data.applicant;

        // Add the new applicant to the search results to make it visible and checked
        setSearchedApplicants(prev => [newApplicant, ...prev.filter(a => a.id !== newApplicant.id)]);

        toast.success('Applicant created successfully.');
        setIsApplicantCreateFormOpen(false);

        handleFormChange('ApplicantName', `${newApplicant.FirstName} ${newApplicant.LastName}`, setErrors);
        handleFormChange('ApplicantID', newApplicant.id.toString(), setErrors);
        handleFormChange('ContactNo', newApplicant.ContactNo || '', setErrors);
        handleFormChange('Address', newApplicant.Address || '', setErrors);
        setApplicantSearch("");
        setOpenApplicant(false);
      } else {
        toast.error(response.data.message || 'Failed to create applicant.');
      }
    } catch (error) {
      toast.error('An unexpected error occurred.');
    }
  },[handleFormChange]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-2xl max-h-[90vh] overflow-hidden"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <form onSubmit={handleFormSubmit}>
          <DialogHeader className="px-3 sm:px-6 pt-6">
            <DialogTitle>
              {mode === "create" ? "Create New Franchise" : "Edit Franchise"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Add a new franchise record to the system."
                : "Modify existing franchise details."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-3 sm:p-6 max-h-[calc(90vh-8rem)] overflow-y-auto">
            {/* Owner and Contact */}
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Owner Name <span className="text-red-500">*</span>
                </Label>
                <Popover open={openApplicant} onOpenChange={setOpenApplicant} modal={true}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openApplicant}
                      className="justify-between w-full"
                      disabled={mode !== 'create'}
                    >
                      {formData.ApplicantName || "Select applicant..."}
                      <div className="flex justify-end items-center gap-1 w-auto">
                        {formData.ApplicantID ? (
                          <Button type="button" variant="ghost" className="z-20 opacity-50 w-4 h-4 text-red-600 cursor-pointer shrink-0" onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleFormChange("ApplicantName", "", setErrors);
                              handleFormChange("ApplicantID", "", setErrors);
                              handleFormChange("ContactNo", "", setErrors);
                              handleFormChange("Address", "", setErrors);
                              setOpenApplicant(false);
                          }}>
                            <X />
                          </Button>
                        ): (
                          <ChevronsUpDown className="opacity-50 ml-2 w-4 h-4 shrink-0" />
                        )}
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="shadow-xl p-0 w-[--radix-popover-trigger-width]">
                    <Command className="border-2 border-gray-300">
                      <CommandInput
                        placeholder="Search by name..."
                        className="border-0 outline-0 focus-visible:ring-0 ring-offset-0 focus-visible:ring-offset-0 h-9"
                        value={applicantSearch}
                        onValueChange={setApplicantSearch}
                      />
                      <CommandEmpty>
                        {!loadingStates.applicantSearch && debouncedSearch && searchedApplicants.length === 0 && (
                          <Button onClick={() => handleApplicantCreate(debouncedSearch)} variant="ghost">Create "{debouncedSearch}"</Button>
                        )}
                      </CommandEmpty>
                      <CommandGroup className="max-h-60 overflow-y-auto">
                        {loadingStates.applicantSearch && (
                          <div className="p-2 text-muted-foreground text-sm text-center">
                            Loading...
                          </div>
                        )}
                        {!loadingStates.applicantSearch && !debouncedSearch && (
                          <div className="p-2 text-muted-foreground text-sm text-center">
                            Start typing to search for an applicant.
                          </div>
                        )}
                        {searchedApplicants.map((applicant) => (
                          <CommandItem
                            key={applicant.id}
                            value={`${applicant.FirstName} ${applicant.LastName}`}
                            onSelect={() => {
                              const applicantName = `${applicant.FirstName} ${applicant.LastName}`;
                              handleFormChange('ApplicantName', applicantName, setErrors);
                              handleFormChange('ApplicantID', applicant.id.toString(), setErrors);
                              handleFormChange('ContactNo', applicant.ContactNo, setErrors);
                              handleFormChange('Address', applicant.Address, setErrors);
                              setOpenApplicant(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${formData.ApplicantID === applicant.id.toString() ? "opacity-100" : "opacity-0"}`} />
                            {applicant.FirstName} {applicant.LastName}{applicant.Gender ? ` (${applicant.Gender})` : ""}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Contact Number</Label>
                <Input
                  id="contact"
                  placeholder="e.g., +639123456789"
                  readOnly={true}
                  value={formData.ContactNo || ""}
                  onChange={(e) => handleFormChange("ContactNo", e.target.value, setErrors)}
                  className={errors.ContactNo ? "border-red-500" : ""}
                />
                {errors.ContactNo && (
                  <p className="text-red-500 text-sm">{errors.ContactNo}</p>
                )}
              </div>
            </div>


            {/* Address + Route */}
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  readOnly={true}
                  placeholder="e.g., Zone III"
                  value={formData.Address || ""}
                  onChange={(e) => handleFormChange("Address", e.target.value, setErrors)}
                  className={errors.Address ? "border-red-500" : ""}
                />
                {errors.Address && (
                  <p className="text-red-500 text-sm">{errors.Address}</p>
                )}
              </div>

              {/* Route */}
              <div className="space-y-2">
                <Label htmlFor="route">
                  Route <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.Route || ""}
                  disabled={formData.Status === 'drop'}
                  onValueChange={(value) => handleFormChange('Route', value, setErrors)}
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

            {/* Franchise No + Plate No */}
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="franchise-no">
                  Franchise Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="franchise-no"
                  placeholder="e.g., 000-0000"
                  disabled={formData.Status === 'drop'}
                  value={formData.FranchiseNo || ""}
                  onChange={(e) => handleFormChange("FranchiseNo", e.target.value, setErrors)}
                  className={errors.FranchiseNo ? "border-red-500" : ""}
                />
                {errors.FranchiseNo && (
                  <p className="text-red-500 text-sm">{errors.FranchiseNo}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="plate-no">
                  Plate Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="plate-no"
                  placeholder="e.g., ABC-1234"
                  value={formData.PlateNo || ""}
                  disabled={formData.Status === 'drop'}
                  onChange={(e) => handleFormChange("PlateNo", e.target.value, setErrors)}
                  className={errors.PlateNo ? "border-red-500" : ""}
                />
                {errors.PlateNo && (
                  <p className="text-red-500 text-sm">{errors.PlateNo}</p>
                )}
              </div>
            </div>

            {/* Make + Status */}
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              
              <div className="space-y-2">
                <Label htmlFor="make">
                  Make <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.MakeID ? String(formData.MakeID) : ''}
                  disabled={formData.Status === 'drop'}
                  onValueChange={(value) => handleFormChange('MakeID', value, setErrors)}
                >
                  <SelectTrigger  id="make" className={errors.MakeID ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select make" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {makes.map((make) => (
                      <SelectItem key={make.id} value={String(make.id)}>
                        {make.Name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {errors.MakeID && (
                  <p className="text-red-500 text-sm">{errors.MakeID}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.Status || "new"}
                  onValueChange={(value) => handleFormChange("Status", value, setErrors)}
                  disabled={true}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="renew">Renew</SelectItem>
                    <SelectItem value="drop">Drop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Chassis + Engine */}
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="chassis">
                  Chassis Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="chassis"
                  disabled={formData.Status === 'drop'}
                  value={formData.ChassisNo || ""}
                  onChange={(e) => handleFormChange("ChassisNo", e.target.value, setErrors)}
                  className={errors.ChassisNo ? "border-red-500" : ""}
                />
                {errors.ChassisNo && (
                  <p className="text-red-500 text-sm">{errors.ChassisNo}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="engine">
                  Engine Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="engine"
                  disabled={formData.Status === 'drop'}
                  value={formData.EngineNo || ""}
                  onChange={(e) => handleFormChange("EngineNo", e.target.value, setErrors)}
                  className={errors.EngineNo ? "border-red-500" : ""}
                />
                {errors.EngineNo && (
                  <p className="text-red-500 text-sm">{errors.EngineNo}</p>
                )}
              </div>
            </div>

            {/* OR No + Amount */}
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="or-no">
                  OR Number
                </Label>
                <Input
                  id="or-no"
                  placeholder="e.g., 1234567"
                  disabled={formData.Status === 'drop'}
                  value={formData.ORNo || ""}
                  onChange={(e) => handleFormChange("ORNo", e.target.value, setErrors)}
                  className={errors.ORNo ? "border-red-500" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">
                  Amount
                </Label>
                <Input
                  id="amount"
                  type="number"
                  disabled={formData.Status === 'drop'}
                  placeholder="e.g., 150.00"
                  value={formData.Amount || ""}
                  onChange={(e) => handleFormChange("Amount", e.target.value, setErrors)}
                  className={errors.Amount ? "border-red-500" : ""}
                />
              </div>
            </div>

            {/* Dates */}
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date-issued">
                  Date Issued <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="date-issued"
                  type="date"
                  disabled={formData.Status === 'drop'}
                  value={formData.DateIssued || ""}
                  onChange={(e) => handleFormChange("DateIssued", e.target.value, setErrors)}
                  className={errors.DateIssued ? "border-red-500" : ""}
                />
                {errors.DateIssued && (
                  <p className="text-red-500 text-sm">{errors.DateIssued}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry-date">Expiry Date</Label>
                <Input
                  id="expiry-date"
                  type="date"
                  disabled={formData.Status === 'drop'}
                  value={formData.ExpiryDate || ""}
                  onChange={(e) => handleFormChange("ExpiryDate", e.target.value, setErrors)}
                  className={errors.ExpiryDate ? "border-red-500" : ""}
                />
                {errors.ExpiryDate && (
                  <p className="text-red-500 text-sm">{errors.ExpiryDate}</p>
                )}
              </div>
            </div>

            {/* Renewal Date */}
            {/* {formData.Status === 'renew' && <>
              <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="last-renewal-date">
                    Last Renewal Date
                  </Label>
                  <Input
                    id="last-renewal-date"
                    type="date"
                    value={formData.LastRenewalDate || ""}
                    onChange={(e) => handleFormChange("LastRenewalDate", e.target.value, setErrors)}
                    className={errors.LastRenewalDate ? "border-red-500" : ""}
                  />
                  {errors.LastRenewalDate && (
                    <p className="text-red-500 text-sm">{errors.LastRenewalDate}</p>
                  )}
                </div>
              </div>
            </>} */}

            {/* Drop reason */}
            {formData.Status === "drop" && (
              <div className="space-y-2">
                <Label htmlFor="drop-reason">
                  Drop Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="drop-reason"
                  placeholder="Explain the reason for dropping this franchise"
                  value={formData.DropReason || ""}
                  onChange={(e) => handleFormChange("DropReason", e.target.value, setErrors)}
                  className={errors.DropReason ? "border-red-500" : ""}
                />
                {errors.DropReason && (
                  <p className="text-red-500 text-sm">{errors.DropReason}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="bottom-0 sticky flex sm:flex-row flex-col justify-end gap-2 bg-white p-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#008ea2] hover:bg-[#007a8b]"
            >
              {mode === "create" ? "Create Franchise" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Render the ApplicantCreateDialog */}
      <ApplicantFormDialog
        open={isApplicantCreateFormOpen}
        onClose={() => setIsApplicantCreateFormOpen(false)}
        onSave={handleApplicantCreateSuccess}
        initialName={applicantNameToCreate}
        applicant={null}
        mode="create"
      />
    </Dialog>
  );
});

export default FranchiseFormDialog;
