import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export type ExportPdfType =
  | 'report'
  | 'summaryByRoute'
  | 'activeHolders'
  | 'expiring30'
  | 'expiring60'
  | 'expiring90'
  | 'droppedMasterlist'
  | 'perHolderSummary';

type ExportTypeOption =
  | 'report'
  | 'summaryByRoute'
  | 'activeHolders'
  | 'expiring'
  | 'droppedMasterlist'
  | 'perHolderSummary';

export type ExportPdfStatus = 'all' | 'new' | 'renew' | 'drop' | 'active';
export type ExportPdfAction = 'download' | 'open' | 'print';
export type ExportFileFormat = 'pdf' | 'excel';
export type ExportPdfGender = 'all' | 'M' | 'F';
export type ExpiringWindow = 30 | 60 | 90;

export type ExportPdfOptions = {
  type: ExportPdfType;
  action: ExportPdfAction;
  format?: ExportFileFormat;
  status?: ExportPdfStatus;
  gender?: ExportPdfGender;
};

interface ExportPdfDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (
    startDate: Date | null,
    endDate: Date | null,
    options?: ExportPdfOptions
  ) => Promise<void>;
  isExporting: boolean;
  defaultType?: ExportPdfType;
}

const useForm = () => {
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
  });

  const handleChange = useCallback(
    (field: 'startDate' | 'endDate', value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value.trimStart() }));
    },
    []
  );

  return { formData, handleChange, setFormData };
};

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mapDefaultTypeToSelectableType(type: ExportPdfType): ExportTypeOption {
  if (type === 'expiring30' || type === 'expiring60' || type === 'expiring90') {
    return 'expiring';
  }

  return type;
}

function mapDefaultTypeToWindow(type: ExportPdfType): ExpiringWindow {
  switch (type) {
    case 'expiring60':
      return 60;
    case 'expiring90':
      return 90;
    case 'expiring30':
    default:
      return 30;
  }
}

function mapExpiringWindowToType(
  window: ExpiringWindow
): Extract<ExportPdfType, 'expiring30' | 'expiring60' | 'expiring90'> {
  switch (window) {
    case 60:
      return 'expiring60';
    case 90:
      return 'expiring90';
    case 30:
    default:
      return 'expiring30';
  }
}

function getTypeLabel(type: ExportTypeOption) {
  switch (type) {
    case 'summaryByRoute':
      return 'Summary By Route';
    case 'activeHolders':
      return 'Active Franchise Holders';
    case 'expiring':
      return 'Expiring Franchises';
    case 'droppedMasterlist':
      return 'Dropped Franchise Masterlist';
    case 'perHolderSummary':
      return 'Per Holder Summary';
    case 'report':
    default:
      return 'Franchise Report';
  }
}

function getStatusLabel(status: ExportPdfStatus) {
  switch (status) {
    case 'new':
      return 'New';
    case 'renew':
      return 'Renew';
    case 'drop':
      return 'Drop';
    case 'active':
      return 'Active (Not Dropped)';
    case 'all':
    default:
      return 'All';
  }
}

function getGenderLabel(gender: ExportPdfGender) {
  switch (gender) {
    case 'M':
      return 'Male';
    case 'F':
      return 'Female';
    case 'all':
    default:
      return 'All';
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <label className="font-medium text-slate-700 text-sm">{label}</label>
        {hint ? <p className="mt-0.5 text-slate-500 text-xs">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export default function ExportPdfDialog({
  open,
  onClose,
  onExport,
  isExporting,
  defaultType = 'report',
}: ExportPdfDialogProps) {
  const { formData, handleChange, setFormData } = useForm();
  const [exportType, setExportType] = useState<ExportTypeOption>(
    mapDefaultTypeToSelectableType(defaultType)
  );
  const [statusFilter, setStatusFilter] = useState<ExportPdfStatus>('all');
  const [genderFilter, setGenderFilter] = useState<ExportPdfGender>('all');
  const [expiringWindow, setExpiringWindow] = useState<ExpiringWindow>(
    mapDefaultTypeToWindow(defaultType)
  );

  const applyTypeDefaults = useCallback(
    (type: ExportTypeOption) => {
      if (type === 'report' || type === 'summaryByRoute') {
        setFormData({
          startDate: formatDateForInput(new Date(new Date().getFullYear(), 0, 1)),
          endDate: formatDateForInput(new Date(new Date().getFullYear(), 11, 31)),
        });
      } else {
        setFormData({
          startDate: '',
          endDate: '',
        });
      }
    },
    [setFormData]
  );

  useEffect(() => {
    if (!open) return;

    const mappedType = mapDefaultTypeToSelectableType(defaultType);
    setExportType(mappedType);
    setStatusFilter('all');
    setGenderFilter('all');
    setExpiringWindow(mapDefaultTypeToWindow(defaultType));
    applyTypeDefaults(mappedType);
  }, [defaultType, open, applyTypeDefaults]);

  const requiresDateRange = exportType === 'report' || exportType === 'summaryByRoute';
  const supportsOptionalDateFilter =
    exportType === 'activeHolders' ||
    exportType === 'droppedMasterlist' ||
    exportType === 'perHolderSummary';
  const isStatusVisible = exportType === 'report';
  const isExpiringType = exportType === 'expiring';

  const title = useMemo(() => `Export ${getTypeLabel(exportType)}`, [exportType]);

  const description = useMemo(() => {
    switch (exportType) {
      case 'summaryByRoute':
        return 'Generate a route-based summary using a required date range.';
      case 'activeHolders':
        return 'Export active franchise holders. Dates are optional.';
      case 'expiring':
        return 'Export active units that are nearing expiration.';
      case 'droppedMasterlist':
        return 'Export dropped franchise records. Dates are optional.';
      case 'perHolderSummary':
        return 'Export one row per holder summary. Dates are optional.';
      case 'report':
      default:
        return 'Generate the franchise report using a required date range.';
    }
  }, [exportType]);

  const selectionText = useMemo(() => {
    const parts: string[] = [getTypeLabel(exportType), `Gender: ${getGenderLabel(genderFilter)}`];

    if (isStatusVisible) {
      parts.push(getStatusLabel(statusFilter));
    }

    if (isExpiringType) {
      parts.push(`Within ${expiringWindow} days`);
    }

    if (requiresDateRange) {
      if (formData.startDate && formData.endDate) {
        parts.push(`${formData.startDate} to ${formData.endDate}`);
      } else {
        parts.push('Date range required');
      }
    } else if (supportsOptionalDateFilter) {
      if (!formData.startDate && !formData.endDate) {
        parts.push('All records');
      } else if (formData.startDate && !formData.endDate) {
        parts.push(`From ${formData.startDate}`);
      } else if (formData.startDate && formData.endDate) {
        parts.push(`${formData.startDate} to ${formData.endDate}`);
      }
    }

    return parts.join(' • ');
  }, [
    expiringWindow,
    exportType,
    formData.endDate,
    formData.startDate,
    genderFilter,
    isExpiringType,
    isStatusVisible,
    requiresDateRange,
    statusFilter,
    supportsOptionalDateFilter,
  ]);

  const doExport = async (action: ExportPdfAction, format: ExportFileFormat = 'pdf') => {
    if (requiresDateRange && (!formData.startDate || !formData.endDate)) {
      toast.error('Please select both a start date and an end date.');
      return;
    }

    if (supportsOptionalDateFilter && !formData.startDate && formData.endDate) {
      toast.error('Please select a start date first, or leave both dates blank for All.');
      return;
    }

    const startDateObj = formData.startDate
      ? new Date(`${formData.startDate}T00:00:00`)
      : null;
    const endDateObj = formData.endDate
      ? new Date(`${formData.endDate}T00:00:00`)
      : null;

    if (
      (requiresDateRange || (startDateObj && endDateObj)) &&
      startDateObj &&
      endDateObj &&
      endDateObj < startDateObj
    ) {
      toast.error('End date cannot be earlier than the start date.');
      return;
    }

    const resolvedType: ExportPdfType =
      exportType === 'expiring'
        ? mapExpiringWindowToType(expiringWindow)
        : exportType;

    await onExport(startDateObj, endDateObj, {
      type: resolvedType,
      action,
      format,
      status: isStatusVisible ? statusFilter : undefined,
      gender: genderFilter,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="p-0 sm:max-w-xl overflow-hidden">
        <DialogHeader className="bg-slate-50 px-5 py-4 border-b">
          <DialogTitle className="text-base sm:text-lg">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {description} Choose PDF or Excel below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <Field label="Export Type">
            <select
              className="bg-white px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-[#008ea2]/20 focus:ring-2 w-full text-sm"
              value={exportType}
              onChange={(e) => {
                const nextType = e.target.value as ExportTypeOption;
                setExportType(nextType);
                setStatusFilter('all');

                if (nextType !== 'expiring') {
                  setExpiringWindow(30);
                }

                applyTypeDefaults(nextType);
              }}
              disabled={isExporting}
            >
              <option value="report">Franchise Report</option>
              <option value="summaryByRoute">Summary By Route</option>
              <option value="activeHolders">Active Units</option>
              <option value="expiring">Expiring Within 30/60/90 Days</option>
              <option value="droppedMasterlist">Dropped Franchise Masterlist</option>
              <option value="perHolderSummary">Per Holder Summary</option>
            </select>
          </Field>

          <Field label="Gender">
            <select
              className="bg-white px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-[#008ea2]/20 focus:ring-2 w-full text-sm"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as ExportPdfGender)}
              disabled={isExporting}
            >
              <option value="all">All</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </Field>

          {isStatusVisible ? (
            <Field label="Status">
              <select
                className="bg-white px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-[#008ea2]/20 focus:ring-2 w-full text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ExportPdfStatus)}
                disabled={isExporting}
              >
                <option value="all">All</option>
                <option value="new">New</option>
                <option value="renew">Renew</option>
                <option value="drop">Drop</option>
                <option value="active">Active (Not Dropped)</option>
              </select>
            </Field>
          ) : null}

          {isExpiringType ? (
            <Field label="Expiring Window">
              <select
                className="bg-white px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-[#008ea2]/20 focus:ring-2 w-full text-sm"
                value={expiringWindow}
                onChange={(e) => setExpiringWindow(Number(e.target.value) as ExpiringWindow)}
                disabled={isExporting}
              >
                <option value={30}>Within 30 days</option>
                <option value={60}>Within 60 days</option>
                <option value={90}>Within 90 days</option>
              </select>
            </Field>
          ) : null}

          {(requiresDateRange || supportsOptionalDateFilter) ? (
            <div className="space-y-3 bg-slate-50 px-4 py-3 border rounded-lg">
              <div>
                <p className="font-medium text-slate-700 text-sm">Date Filter</p>
                <p className="mt-0.5 text-slate-500 text-xs leading-relaxed">
                  {requiresDateRange
                    ? 'Both start date and end date are required.'
                    : 'Leave both dates blank for All. Enter only start date to filter from that date onward.'}
                </p>
              </div>

              <div className="gap-3 grid grid-cols-1 sm:grid-cols-2">
                <Field label="Start Date">
                  <Input
                    id="start-date"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleChange('startDate', e.target.value)}
                    disabled={isExporting}
                  />
                </Field>

                <Field label="End Date">
                  <Input
                    id="end-date"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleChange('endDate', e.target.value)}
                    disabled={isExporting}
                  />
                </Field>
              </div>
            </div>
          ) : null}

          <div className="bg-white px-4 py-3 border rounded-lg">
            <p className="font-medium text-slate-700 text-sm">Current Selection</p>
            <p className="mt-1 text-slate-500 text-sm leading-relaxed">{selectionText}</p>
          </div>
        </div>

        <DialogFooter className="flex sm:flex-row flex-col gap-2 bg-white px-5 py-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>

          <Button
            variant="outline"
            onClick={() => void doExport('open')}
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            {isExporting ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
            Open
          </Button>

          <Button
            variant="outline"
            onClick={() => void doExport('print')}
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            {isExporting ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
            Print
          </Button>

          <Button
            variant="outline"
            onClick={() => void doExport('download', 'excel')}
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            {isExporting ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
            Download Excel
          </Button>

          <Button
            onClick={() => void doExport('download', 'pdf')}
            disabled={isExporting}
            className="bg-[#008ea2] hover:bg-[#007a8b] w-full sm:w-auto"
          >
            {isExporting ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
