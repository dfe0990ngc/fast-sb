import { memo, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { Applicant, Franchise, Make } from '../../types/types';
import * as api from '../../api/api';
import { useDebounce } from '@/hooks/useDebounce';
import ApplicantFormDialog from './ApplicantFormDialog';
import FranchiseDocumentsPanel from './FranchiseDocumentsPanel';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';

type FranchiseFormData = Partial<Franchise> & {
  Driver?: string;
  ApplicantID?: string | number | null;
  ApplicantName?: string;
  ContactNo?: string;
  Address?: string;
};

const DEFAULT_FORM_DATA: FranchiseFormData = {
  FranchiseNo: '',
  DateIssued: new Date().toISOString().split('T')[0],
  ExpiryDate: '',
  Route: '',
  Driver: '',
  MakeID: '',
  ChassisNo: '',
  EngineNo: '',
  PlateNo: '',
  ORNo: '',
  Amount: '',
  Status: 'new',
  ApplicantID: null,
  ApplicantName: '',
  ContactNo: '',
  Address: '',
  DropReason: '',
};

interface FranchiseFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: FranchiseFormData) => void;
  searchApplicants: (searchTerm: string) => Promise<Applicant[]>;
  franchise: Franchise | null;
  makes: Make[];
  mode: 'create' | 'edit';
}

function applicantFullName(applicant: Partial<Applicant>) {
  return [applicant.FirstName, applicant.MiddleName, applicant.LastName].filter(Boolean).join(' ').trim();
}

const FranchiseFormDialog = memo(function FranchiseFormDialog({
  open,
  onClose,
  onSave,
  searchApplicants,
  franchise,
  makes,
  mode,
}: FranchiseFormDialogProps) {
  const [formData, setFormData] = useState<FranchiseFormData>(DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openApplicantPicker, setOpenApplicantPicker] = useState(false);
  const [applicantSearch, setApplicantSearch] = useState('');
  const [searchedApplicants, setSearchedApplicants] = useState<Applicant[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(false);
  const [isApplicantCreateFormOpen, setIsApplicantCreateFormOpen] = useState(false);
  const [applicantNameToCreate, setApplicantNameToCreate] = useState('');

  const debouncedSearch = useDebounce(applicantSearch, 350);
  const isEditMode = mode === 'edit';
  const isDroppedRecord = isEditMode && (franchise?.Status || formData.Status) === 'drop';

  useEffect(() => {
    if (!open) {
      return;
    }

    if (franchise && isEditMode) {
      setFormData({
        ...DEFAULT_FORM_DATA,
        ...franchise,
        Driver: (franchise as Franchise & { Driver?: string }).Driver || '',
        ApplicantName: franchise.ApplicantName || '',
        ContactNo: franchise.ContactNo || '',
        Address: franchise.Address || '',
      });
    } else {
      setFormData(DEFAULT_FORM_DATA);
    }

    setErrors({});
    setApplicantSearch('');
    setSearchedApplicants([]);
    setOpenApplicantPicker(false);
  }, [franchise, isEditMode, open]);

  useEffect(() => {
    let isMounted = true;

    const loadApplicants = async () => {
      if (!debouncedSearch.trim()) {
        setSearchedApplicants([]);
        return;
      }

      setIsLoadingApplicants(true);
      try {
        const results = await searchApplicants(debouncedSearch);
        if (isMounted) {
          setSearchedApplicants(results);
        }
      } finally {
        if (isMounted) {
          setIsLoadingApplicants(false);
        }
      }
    };

    void loadApplicants();

    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, searchApplicants]);

  const setField = useCallback((field: keyof FranchiseFormData, value: string | number | null) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: '' }));
  }, []);

  const handleApplicantSelect = useCallback((applicant: Applicant) => {
    setFormData((previous) => ({
      ...previous,
      ApplicantID: applicant.id,
      ApplicantName: applicantFullName(applicant),
      ContactNo: applicant.ContactNo || '',
      Address: applicant.Address || '',
    }));
    setErrors((previous) => ({ ...previous, ApplicantID: '' }));
    setOpenApplicantPicker(false);
    setApplicantSearch('');
  }, []);

  const handleApplicantCreateSuccess = useCallback(async (data: Partial<Applicant>) => {
    try {
      const response = await api.post('/api/applicants', data);

      if (!response.data.success) {
        toast.error(response.data.message || 'Failed to create applicant.');
        return;
      }

      const newApplicant = response.data.applicant as Applicant;
      setSearchedApplicants((previous) => [newApplicant, ...previous.filter((item) => item.id !== newApplicant.id)]);
      handleApplicantSelect(newApplicant);
      setIsApplicantCreateFormOpen(false);
      toast.success('Applicant created successfully.');
    } catch (error) {
      toast.error('An unexpected error occurred while creating the applicant.');
    }
  }, [handleApplicantSelect]);

  const validate = useCallback(() => {
    const nextErrors: Record<string, string> = {};

    if (!formData.ApplicantID) nextErrors.ApplicantID = 'Owner is required';
    if (!formData.FranchiseNo?.toString().trim()) nextErrors.FranchiseNo = 'Franchise number is required';
    if (!formData.DateIssued) nextErrors.DateIssued = 'Date issued is required';
    if (!formData.Route?.toString().trim()) nextErrors.Route = 'Route is required';
    if (!formData.MakeID) nextErrors.MakeID = 'Make is required';
    if (!formData.ChassisNo?.toString().trim()) nextErrors.ChassisNo = 'Chassis number is required';
    if (!formData.EngineNo?.toString().trim()) nextErrors.EngineNo = 'Engine number is required';
    if (!formData.PlateNo?.toString().trim()) nextErrors.PlateNo = 'Plate number is required';

    if (mode === 'create' && !formData.Status) {
      nextErrors.Status = 'Status is required';
    }

    if ((mode === 'create' ? formData.Status : franchise?.Status) === 'renew' && !formData.ExpiryDate) {
      nextErrors.ExpiryDate = 'Expiry date is required for renewal';
    }

    if (formData.ExpiryDate && formData.DateIssued) {
      const issued = new Date(formData.DateIssued);
      const expiry = new Date(formData.ExpiryDate);
      if (expiry < issued) {
        nextErrors.ExpiryDate = 'Expiry date must be after date issued';
      }
    }

    if ((mode === 'create' ? formData.Status : franchise?.Status) === 'drop' && !formData.DropReason?.toString().trim()) {
      nextErrors.DropReason = 'Drop reason is required for dropped records';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [formData, franchise?.Status, mode]);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    onSave(formData);
  }, [formData, onSave, validate]);

  const applicantButtonText = useMemo(() => {
    if (formData.ApplicantName?.trim()) {
      return formData.ApplicantName;
    }

    return 'Select owner';
  }, [formData.ApplicantName]);

  const showDropReason = (mode === 'create' && formData.Status === 'drop') || (mode === 'edit' && franchise?.Status === 'drop');

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent
          className="sm:max-w-4xl max-h-[92vh] overflow-hidden"
          onInteractOutside={(event) => {
            event.preventDefault();
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <DialogHeader className="px-3 sm:px-6 pt-6">
              <DialogTitle>{mode === 'create' ? 'Create New Franchise' : 'Edit Franchise'}</DialogTitle>
              <DialogDescription>
                {mode === 'create'
                  ? 'Create the franchise first, then attach driver authorization PDFs when needed.'
                  : 'Update franchise details and manage the optional driver authorization PDFs.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 p-3 sm:p-6 max-h-[calc(92vh-8rem)] overflow-y-auto">
              <section className="space-y-4 p-4 border rounded-2xl">
                <div>
                  <h3 className="font-semibold text-base">Owner Information</h3>
                  <p className="text-muted-foreground text-sm">
                    Select an existing applicant, or create one without leaving this form.
                  </p>
                </div>

                <div className="gap-4 grid grid-cols-1 lg:grid-cols-[1.3fr,1fr,1fr]">
                  <div className="space-y-2">
                    <Label>
                      Owner Name <span className="text-red-500">*</span>
                    </Label>

                    <Popover open={openApplicantPicker} onOpenChange={setOpenApplicantPicker}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className={`w-full justify-between ${errors.ApplicantID ? 'border-red-500' : ''}`}
                        >
                          <span className="text-left truncate">{applicantButtonText}</span>
                          <ChevronsUpDown className="opacity-60 ml-2 w-4 h-4 shrink-0" />
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent className="p-0 w-[min(92vw,520px)]" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search applicant..."
                            value={applicantSearch}
                            onValueChange={setApplicantSearch}
                          />

                          {isLoadingApplicants ? (
                            <div className="px-4 py-6 text-muted-foreground text-sm">Searching applicants...</div>
                          ) : null}

                          <CommandEmpty className="px-3 py-4 text-sm">
                            <div className="space-y-3">
                              <p>No applicant found.</p>
                              <Button
                                type="button"
                                size="sm"
                                className="bg-[#008ea2] hover:bg-[#007a8b]"
                                onClick={() => {
                                  setApplicantNameToCreate(applicantSearch.trim());
                                  setIsApplicantCreateFormOpen(true);
                                  setOpenApplicantPicker(false);
                                }}
                              >
                                Create applicant
                              </Button>
                            </div>
                          </CommandEmpty>

                          <CommandGroup className="max-h-72 overflow-y-auto">
                            {searchedApplicants.map((applicant) => {
                              const label = applicantFullName(applicant);

                              return (
                                <CommandItem
                                  key={applicant.id}
                                  value={`${applicant.id}`}
                                  onSelect={() => handleApplicantSelect(applicant)}
                                  className="flex justify-between items-start gap-3"
                                >
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">{label}</div>
                                    <div className="text-muted-foreground text-xs truncate">
                                      {[applicant.ContactNo, applicant.Address].filter(Boolean).join(' • ')}
                                    </div>
                                  </div>

                                  <Check
                                    className={`h-4 w-4 ${String(formData.ApplicantID) === String(applicant.id) ? 'opacity-100' : 'opacity-0'}`}
                                  />
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {errors.ApplicantID ? <p className="text-red-500 text-sm">{errors.ApplicantID}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="owner-contact">Contact Number</Label>
                    <Input id="owner-contact" value={formData.ContactNo || ''} readOnly className="bg-muted/40" />
                  </div>

                  <div className="space-y-2 lg:col-span-1">
                    <Label htmlFor="owner-address">Address</Label>
                    <Input id="owner-address" value={formData.Address || ''} readOnly className="bg-muted/40" />
                  </div>
                </div>
              </section>

              <section className="space-y-4 p-4 border rounded-2xl">
                <div>
                  <h3 className="font-semibold text-base">Franchise Details</h3>
                  <p className="text-muted-foreground text-sm">
                    Keep the core details clear and consistent for list, print, and export views.
                  </p>
                </div>

                {isDroppedRecord ? (
                  <div className="bg-amber-50 p-3 border border-amber-200 rounded-xl text-amber-700 text-sm">
                    This franchise is already marked as dropped. Only the drop reason can be updated here.
                  </div>
                ) : null}

                <div className="gap-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="franchise-no">
                      Franchise Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="franchise-no"
                      value={formData.FranchiseNo || ''}
                      onChange={(event) => setField('FranchiseNo', event.target.value.toUpperCase())}
                      className={errors.FranchiseNo ? 'border-red-500' : ''}
                      disabled={isDroppedRecord}
                    />
                    {errors.FranchiseNo ? <p className="text-red-500 text-sm">{errors.FranchiseNo}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date-issued">
                      Date Issued <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="date-issued"
                      type="date"
                      value={formData.DateIssued || ''}
                      onChange={(event) => setField('DateIssued', event.target.value)}
                      className={errors.DateIssued ? 'border-red-500' : ''}
                      disabled={isDroppedRecord}
                    />
                    {errors.DateIssued ? <p className="text-red-500 text-sm">{errors.DateIssued}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">
                      Status {mode === 'create' ? <span className="text-red-500">*</span> : null}
                    </Label>
                    <Select
                      value={String(mode === 'create' ? formData.Status || 'new' : franchise?.Status || 'new')}
                      onValueChange={(value) => setField('Status', value)}
                      disabled={mode === 'edit'}
                    >
                      <SelectTrigger id="status" className={errors.Status ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="renew">Renew</SelectItem>
                        <SelectItem value="drop">Drop</SelectItem>
                      </SelectContent>
                    </Select>
                    {mode === 'edit' ? (
                      <p className="text-muted-foreground text-xs">
                        Renewal and drop actions are managed from the dedicated franchise actions.
                      </p>
                    ) : null}
                    {errors.Status ? <p className="text-red-500 text-sm">{errors.Status}</p> : null}
                  </div>

                  <div className="space-y-2 md:col-span-2 xl:col-span-1">
                    <Label htmlFor="route">
                      Route <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="route"
                      value={formData.Route || ''}
                      onChange={(event) => setField('Route', event.target.value.toUpperCase())}
                      className={errors.Route ? 'border-red-500' : ''}
                      disabled={isDroppedRecord}
                    />
                    {errors.Route ? <p className="text-red-500 text-sm">{errors.Route}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="make">
                      Make <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={String(formData.MakeID || '')}
                      onValueChange={(value) => setField('MakeID', value)}
                      disabled={isDroppedRecord}
                    >
                      <SelectTrigger id="make" className={errors.MakeID ? 'border-red-500' : ''}>
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
                    {errors.MakeID ? <p className="text-red-500 text-sm">{errors.MakeID}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="plate-no">
                      Plate Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="plate-no"
                      value={formData.PlateNo || ''}
                      onChange={(event) => setField('PlateNo', event.target.value.toUpperCase())}
                      className={errors.PlateNo ? 'border-red-500' : ''}
                      disabled={isDroppedRecord}
                    />
                    {errors.PlateNo ? <p className="text-red-500 text-sm">{errors.PlateNo}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expiry-date">Expiry Date</Label>
                    <Input
                      id="expiry-date"
                      type="date"
                      value={formData.ExpiryDate || ''}
                      onChange={(event) => setField('ExpiryDate', event.target.value)}
                      className={errors.ExpiryDate ? 'border-red-500' : ''}
                      disabled={isDroppedRecord}
                    />
                    {errors.ExpiryDate ? <p className="text-red-500 text-sm">{errors.ExpiryDate}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="or-no">OR Number</Label>
                    <Input
                      id="or-no"
                      value={formData.ORNo || ''}
                      onChange={(event) => setField('ORNo', event.target.value.toUpperCase())}
                      disabled={isDroppedRecord}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={formData.Amount || ''}
                      onChange={(event) => setField('Amount', event.target.value)}
                      disabled={isDroppedRecord}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4 p-4 border rounded-2xl">
                <div>
                  <h3 className="font-semibold text-base">Vehicle and Authorized Driver</h3>
                  <p className="text-muted-foreground text-sm">
                    Driver authorization PDFs are optional and belong to the franchise record.
                  </p>
                </div>

                <div className="gap-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="chassis-no">
                      Chassis Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="chassis-no"
                      value={formData.ChassisNo || ''}
                      onChange={(event) => setField('ChassisNo', event.target.value.toUpperCase())}
                      className={errors.ChassisNo ? 'border-red-500' : ''}
                      disabled={isDroppedRecord}
                    />
                    {errors.ChassisNo ? <p className="text-red-500 text-sm">{errors.ChassisNo}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="engine-no">
                      Engine Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="engine-no"
                      value={formData.EngineNo || ''}
                      onChange={(event) => setField('EngineNo', event.target.value.toUpperCase())}
                      className={errors.EngineNo ? 'border-red-500' : ''}
                      disabled={isDroppedRecord}
                    />
                    {errors.EngineNo ? <p className="text-red-500 text-sm">{errors.EngineNo}</p> : null}
                  </div>

                  <div className="space-y-2 md:col-span-2 xl:col-span-1">
                    <Label htmlFor="driver-name">Authorized Driver</Label>
                    <Input
                      id="driver-name"
                      value={formData.Driver || ''}
                      onChange={(event) => setField('Driver', event.target.value.toUpperCase())}
                      placeholder="Enter authorized driver name"
                      disabled={isDroppedRecord}
                    />
                  </div>
                </div>

                {showDropReason ? (
                  <div className="space-y-2">
                    <Label htmlFor="drop-reason">
                      Drop Reason <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="drop-reason"
                      value={formData.DropReason || ''}
                      onChange={(event) => setField('DropReason', event.target.value)}
                      rows={4}
                      className={errors.DropReason ? 'border-red-500' : ''}
                    />
                    {errors.DropReason ? <p className="text-red-500 text-sm">{errors.DropReason}</p> : null}
                  </div>
                ) : null}

                <FranchiseDocumentsPanel
                  franchiseId={franchise?.id ?? null}
                  initialDocuments={((franchise as any)?.documents || (franchise as any)?.Documents || []) as any[]}
                />
              </section>
            </div>

            <DialogFooter className="bottom-0 sticky flex sm:flex-row flex-col sm:justify-end gap-2 bg-white p-6 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#008ea2] hover:bg-[#007a8b]">
                {mode === 'create' ? 'Create Franchise' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ApplicantFormDialog
        open={isApplicantCreateFormOpen}
        onClose={() => setIsApplicantCreateFormOpen(false)}
        onSave={handleApplicantCreateSuccess}
        applicant={null}
        mode="create"
        initialName={applicantNameToCreate}
      />
    </>
  );
});

export default FranchiseFormDialog;
