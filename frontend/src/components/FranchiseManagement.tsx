import { useState, useEffect, useMemo, useTransition, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Truck,
} from 'lucide-react';
import ViewFranchiseDialog from './dialogs/ViewFranchiseDialog';
import DeleteFranchiseDialog from './dialogs/DeleteFranchiseDialog';
import FranchiseFormDialog from './dialogs/FranchiseFormDialog';
import FranchiseTable from './dialogs/FranchiseTable';
import RenewFranchiseDialog from './dialogs/RenewFranchiseDialog';
import DropFranchiseDialog from './dialogs/DropFranchiseDialog';
import ExportPdfDialog from './dialogs/ExportPdfDialog';
import { useFranchise } from '../context/FranchiseContext';
import { useMakes } from '../context/MakesContext';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { Franchise, FranchiseFilters } from '../types/types';
import * as api from '../api/api';
import { motion } from 'framer-motion';

type ExportPdfType =
  | 'report'
  | 'summaryByRoute'
  | 'activeHolders'
  | 'droppedMasterlist'
  | 'perHolderSummary'
  | 'expiring30'
  | 'expiring60'
  | 'expiring90';

type ExportPdfAction = 'download' | 'open' | 'print';
type ExportFileFormat = 'pdf' | 'excel';

type ExportPdfStatus = 'all' | 'new' | 'renew' | 'drop' | 'active';
type ExportPdfGender = 'all' | 'M' | 'F';

type ExportPdfOptions = {
  type?: ExportPdfType;
  action?: ExportPdfAction;
  format?: ExportFileFormat;
  status?: ExportPdfStatus;
  gender?: ExportPdfGender;
};

function formatDateForApi(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayForFilename() {
  return new Date().toISOString().split('T')[0];
}

function appendQueryParams(
  endpoint: string,
  paramsInput: Record<string, string | null | undefined>
) {
  const params = new URLSearchParams();

  Object.entries(paramsInput).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, value);
    }
  });

  const query = params.toString();
  if (!query) return endpoint;

  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${query}`;
}

function appendOptionalDateParams(
  endpoint: string,
  start?: string | null,
  end?: string | null,
  extraParams: Record<string, string | null | undefined> = {}
) {
  return appendQueryParams(endpoint, {
    ...extraParams,
    start_date: start ?? undefined,
    end_date: start ? end ?? undefined : undefined,
  });
}

function downloadBlobUrl(blobUrl: string, filename: string) {
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
}

function openBlobUrl(blobUrl: string) {
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
}

function printBlobUrl(blobUrl: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = blobUrl;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      openBlobUrl(blobUrl);
    } finally {
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
        URL.revokeObjectURL(blobUrl);
      }, 10000);
    }
  };
}

function presentPdfBlob(blob: Blob, filename: string, action: ExportPdfAction) {
  const blobUrl = URL.createObjectURL(blob);

  if (action === 'download') return downloadBlobUrl(blobUrl, filename);
  if (action === 'print') return printBlobUrl(blobUrl);

  return openBlobUrl(blobUrl);
}

function getPdfExportConfig(
  type: ExportPdfType,
  start: string | null,
  end: string | null,
  status: ExportPdfStatus,
  gender: ExportPdfGender
) {
  const today = getTodayForFilename();
  const genderParam = gender === 'all' ? 'all' : gender;

  switch (type) {
    case 'summaryByRoute':
      return {
        endpoint: appendQueryParams('/api/franchises/export/summary-by-route/pdf', {
          start_date: start ?? '',
          end_date: end ?? '',
          gender_filter: genderParam,
        }),
        filename: `Franchise_Summary_By_Route_${today}.pdf`,
      };

    case 'activeHolders':
      return {
        endpoint: appendOptionalDateParams('/api/franchises/export/pdf?report_type=activeHolders', start, end, {
          gender_filter: genderParam,
        }),
        filename: `Active_Franchise_Holders_${today}.pdf`,
      };

    case 'droppedMasterlist':
      return {
        endpoint: appendOptionalDateParams('/api/franchises/export/pdf?report_type=droppedMasterlist', start, end, {
          gender_filter: genderParam,
        }),
        filename: `Dropped_Franchise_Masterlist_${today}.pdf`,
      };

    case 'perHolderSummary':
      return {
        endpoint: appendOptionalDateParams('/api/franchises/export/pdf?report_type=perHolderSummary', start, end, {
          gender_filter: genderParam,
        }),
        filename: `Per_Holder_Summary_${today}.pdf`,
      };

    case 'expiring30':
      return {
        endpoint: appendQueryParams('/api/franchises/export/pdf', {
          report_type: 'expiring',
          window: '30',
          gender_filter: genderParam,
        }),
        filename: `Franchises_Expiring_Within_30_Days_${today}.pdf`,
      };

    case 'expiring60':
      return {
        endpoint: appendQueryParams('/api/franchises/export/pdf', {
          report_type: 'expiring',
          window: '60',
          gender_filter: genderParam,
        }),
        filename: `Franchises_Expiring_Within_60_Days_${today}.pdf`,
      };

    case 'expiring90':
      return {
        endpoint: appendQueryParams('/api/franchises/export/pdf', {
          report_type: 'expiring',
          window: '90',
          gender_filter: genderParam,
        }),
        filename: `Franchises_Expiring_Within_90_Days_${today}.pdf`,
      };

    case 'report':
    default:
      return {
        endpoint: appendQueryParams('/api/franchises/export/pdf', {
          start_date: start ?? '',
          end_date: end ?? '',
          status,
          gender_filter: genderParam,
        }),
        filename: `Franchise_Report_${today}.pdf`,
      };
  }
}

function getExcelExportConfig(
  type: ExportPdfType,
  start: string | null,
  end: string | null,
  status: ExportPdfStatus,
  gender: ExportPdfGender
) {
  const today = getTodayForFilename();
  const genderParam = gender === 'all' ? 'all' : gender;

  switch (type) {
    case 'summaryByRoute':
      return {
        endpoint: appendQueryParams('/api/franchises/export/excel', {
          report_type: 'summaryByRoute',
          start_date: start ?? '',
          end_date: end ?? '',
          gender_filter: genderParam,
        }),
        filename: `Franchise_Summary_By_Route_${today}.xlsx`,
      };

    case 'activeHolders':
      return {
        endpoint: appendOptionalDateParams('/api/franchises/export/excel', start, end, {
          report_type: 'activeHolders',
          gender_filter: genderParam,
        }),
        filename: `Active_Franchise_Holders_${today}.xlsx`,
      };

    case 'droppedMasterlist':
      return {
        endpoint: appendOptionalDateParams('/api/franchises/export/excel', start, end, {
          report_type: 'droppedMasterlist',
          gender_filter: genderParam,
        }),
        filename: `Dropped_Franchise_Masterlist_${today}.xlsx`,
      };

    case 'perHolderSummary':
      return {
        endpoint: appendOptionalDateParams('/api/franchises/export/excel', start, end, {
          report_type: 'perHolderSummary',
          gender_filter: genderParam,
        }),
        filename: `Per_Holder_Summary_${today}.xlsx`,
      };

    case 'expiring30':
      return {
        endpoint: appendQueryParams('/api/franchises/export/excel', {
          report_type: 'expiring',
          window: '30',
          gender_filter: genderParam,
        }),
        filename: `Franchises_Expiring_Within_30_Days_${today}.xlsx`,
      };

    case 'expiring60':
      return {
        endpoint: appendQueryParams('/api/franchises/export/excel', {
          report_type: 'expiring',
          window: '60',
          gender_filter: genderParam,
        }),
        filename: `Franchises_Expiring_Within_60_Days_${today}.xlsx`,
      };

    case 'expiring90':
      return {
        endpoint: appendQueryParams('/api/franchises/export/excel', {
          report_type: 'expiring',
          window: '90',
          gender_filter: genderParam,
        }),
        filename: `Franchises_Expiring_Within_90_Days_${today}.xlsx`,
      };

    case 'report':
    default:
      return {
        endpoint: appendQueryParams('/api/franchises/export/excel', {
          report_type: 'report',
          start_date: start ?? '',
          end_date: end ?? '',
          status,
          gender_filter: genderParam,
        }),
        filename: `Franchise_Report_${today}.xlsx`,
      };
  }
}

export default function FranchiseManagement() {
  const { user } = useAuth();
  const {
    fetchFranchises,
    loading,
    franchises,
    pagination,
    createFranchise,
    updateFranchise,
    deleteFranchise,
    statistics,
    fetchStatistics,
  } = useFranchise();
  const { makes, fetchMakes } = useMakes();

  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRoute, setFilterRoute] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterMake, setFilterMake] = useState('all');

  const [activeDialog, setActiveDialog] = useState<
    'view' | 'create' | 'edit' | 'delete' | 'renew' | 'drop' | null
  >(null);
  const [selectedFranchise, setSelectedFranchise] = useState<Franchise | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportDefaultType, setExportDefaultType] = useState<ExportPdfType>('report');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(searchTerm, 500);

  useEffect(() => {
    fetchMakes();
  }, [fetchMakes]);

  useEffect(() => {
    const year = filterYear === 'all' ? 0 : Number(filterYear);
    fetchStatistics(year);
  }, [filterYear, fetchStatistics]);

  const loadFranchises = useCallback(
    async (page = 1) => {
      try {
        const filters: FranchiseFilters = { page, limit: 10 };

        if (debouncedSearch) filters.search = debouncedSearch;
        if (filterStatus !== 'all') filters.status = filterStatus;
        if (filterRoute !== 'all') filters.route = filterRoute;
        if (filterYear !== 'all') filters.year = filterYear;
        if (filterMake !== 'all') filters.make_id = filterMake;

        await fetchFranchises(filters);
      } catch (error: any) {
        console.error('Failed to load franchises', error);
      }
    },
    [debouncedSearch, filterStatus, filterRoute, filterYear, filterMake, fetchFranchises]
  );

  useEffect(() => {
    startTransition(() => {
      loadFranchises(1);
    });
  }, [loadFranchises]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.total_pages) {
      startTransition(() => {
        loadFranchises(newPage);
      });
    }
  };

  const routes = useMemo(() => {
    return statistics?.available_routes || [];
  }, [statistics]);

  const years = useMemo(() => {
    return statistics?.available_years || [];
  }, [statistics]);

  const openDialog = useCallback(
    (
      type: 'view' | 'create' | 'edit' | 'delete' | 'renew' | 'drop',
      franchise: Franchise | null = null
    ) => {
      setSelectedFranchise(franchise);
      setActiveDialog(type);
    },
    []
  );

  const searchApplicants = useCallback(async (searchTerm: string) => {
    if (!searchTerm) {
      return [];
    }

    try {
      const response = await api.get(`/api/applicants?search=${searchTerm}&limit=20`);
      if (response.data.success) {
        return response.data.applicants;
      }
    } catch (error) {
      console.error('Failed to search applicants', error);
    }

    return [];
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === '1') {
        event.preventDefault();
        openDialog('create');
      }

      if (event.ctrlKey && (event.key === 'x' || event.key === 'X')) {
        event.preventDefault();
        setIsExportDialogOpen(true);
      }

      if (event.ctrlKey && (event.key === 'f' || event.key === 'F')) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openDialog]);

  const closeDialog = () => {
    setActiveDialog(null);
    setTimeout(() => setSelectedFranchise(null), 150);
  };

  const handleCreate = async (data: Omit<Franchise, 'id'>) => {
    setIsSubmitting(true);

    try {
      const result = await createFranchise(data);

      if (result.success) {
        toast.success(result.message || 'Franchise created successfully.');
        await Promise.all([
          loadFranchises(1),
          fetchStatistics(filterYear === 'all' ? 0 : Number(filterYear)),
        ]);
      } else {
        toast.error(result.message || 'Failed to create franchise.');
      }

      closeDialog();
    } catch (err) {
      const errMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        'An unexpected error occurred.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActionSuccess = async () => {
    toast.success('Franchise updated successfully.');

    try {
      await Promise.all([
        loadFranchises(pagination.current_page),
        fetchStatistics(filterYear === 'all' ? 0 : Number(filterYear)),
      ]);
    } catch (error) {
      console.error('Failed to refresh data after action:', error);
      toast.error('Failed to refresh franchise data.');
    }

    closeDialog();
  };

  const handleUpdate = async (data: Partial<Franchise>) => {
    if (!selectedFranchise) return;

    setIsSubmitting(true);

    try {
      const result = await updateFranchise(selectedFranchise.id, data);

      if (result.success) {
        toast.success(result.message || 'Franchise updated successfully.');
        await Promise.all([
          loadFranchises(pagination.current_page),
          fetchStatistics(filterYear === 'all' ? 0 : Number(filterYear)),
        ]);
      } else {
        toast.error(result.message || 'Failed to update franchise.');
      }

      closeDialog();
    } catch (err) {
      const errMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        'An unexpected error occurred.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFranchise) return;

    setIsSubmitting(true);

    try {
      const result = await deleteFranchise(selectedFranchise.id);

      if (result.success) {
        toast.success(result.message || 'Franchise deleted successfully.');
        await Promise.all([
          loadFranchises(pagination.current_page),
          fetchStatistics(filterYear === 'all' ? 0 : Number(filterYear)),
        ]);
      } else {
        toast.error(result.message || 'Failed to delete franchise.');
      }

      closeDialog();
    } catch (err) {
      const errMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        'An unexpected error occurred.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportPdf = async (
    startDate: Date | null,
    endDate: Date | null,
    options?: ExportPdfOptions
  ) => {
    setIsExporting(true);

    const type = options?.type ?? exportDefaultType ?? 'report';
    const action = options?.action ?? 'download';
    const format = options?.format ?? 'pdf';
    const status = options?.status ?? 'all';
    const gender = options?.gender ?? 'all';

    try {
      const start = startDate ? formatDateForApi(startDate) : null;
      const end = endDate ? formatDateForApi(endDate) : null;

      if (format === 'excel') {
        const { endpoint, filename } = getExcelExportConfig(type, start, end, status, gender);
        const { data } = await api.get(endpoint, { responseType: 'blob' });
        const blob = new Blob([
          data,
        ], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const blobUrl = URL.createObjectURL(blob);
        downloadBlobUrl(blobUrl, filename);
        toast.success('Excel downloaded successfully!');
        setIsExportDialogOpen(false);
        return;
      }

      const { endpoint, filename } = getPdfExportConfig(type, start, end, status, gender);

      const { data } = await api.get(endpoint, { responseType: 'blob' });
      const blob = new Blob([data], { type: 'application/pdf' });

      presentPdfBlob(blob, filename, action);

      toast.success(
        action === 'download'
          ? 'PDF downloaded successfully!'
          : action === 'print'
            ? 'Opening print dialog...'
            : 'Opened PDF in a new tab.'
      );

      setIsExportDialogOpen(false);
    } catch (err) {
      const errMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        'An unexpected error occurred.';
      toast.error(errMsg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFormPdf = async (franchise: Franchise, action: ExportPdfAction = 'print') => {
    setPrintingId(franchise.id);

    try {
      const { data } = await api.get(
        `/api/franchises/${franchise.id}/export-form?history_id=${franchise.histID}`,
        {
          responseType: 'blob',
        }
      );

      const blob = new Blob([data], { type: 'application/pdf' });
      const filename = `Franchise_Application_${franchise.FranchiseNo}.pdf`;

      presentPdfBlob(blob, filename, action);

      toast.success(
        action === 'download'
          ? 'Form downloaded successfully!'
          : action === 'print'
            ? 'Opening print dialog...'
            : 'Opened form in a new tab.'
      );
    } catch (err) {
      const errMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        'An unexpected error occurred.';
      toast.error(errMsg);
    } finally {
      setPrintingId(null);
    }
  };

  const stats = useMemo(() => {
    if (!statistics?.by_status) {
      return { total: 0, newCount: 0, renewCount: 0, dropCount: 0, expiringSoon: 0 };
    }

    const newCount = statistics.totals.new_count || 0;
    const renewCount = statistics.totals.renew_count || 0;
    const dropCount = statistics.totals.drop_count || 0;
    const total = statistics.totals?.total || 0;
    const expiringSoon = statistics.totals?.expiring_soon || 0;

    return { total, newCount, renewCount, dropCount, expiringSoon };
  }, [statistics]);

  if (loading.isLoading && !franchises.length) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block border-[#008ea2] border-t-2 border-r-2 border-b-2 border-l-transparent rounded-full w-8 h-8 animate-spin"></div>
          <p className="mt-2 text-muted-foreground">Loading franchises...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      transition={{
        delay: 0.1,
        duration: 0.25,
        type: 'tween',
      }}
      className="space-y-4 p-0 sm:p-4"
    >
      <div className="relative flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
        <div className="-top-8 right-0 absolute font-mono text-[11px]">
          <span>
            New: <strong className="font-extrabold">[Alt + 1]</strong>
          </span>
          &nbsp;
          <span>
            Export: <strong className="font-extrabold">[Ctrl + X]</strong>
          </span>
          &nbsp;
          <span>
            Search: <strong className="font-extrabold">[Ctrl + F]</strong>
          </span>
        </div>

        <div>
          <h1 className="font-medium text-lg">Franchise Management</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage franchise records and track renewals
          </p>
        </div>

        <div className="flex sm:flex-row flex-col gap-2 w-full sm:w-auto">
          <Button
            onClick={() => {
              setExportDefaultType('summaryByRoute');
              setIsExportDialogOpen(true);
            }}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <FileText className="mr-2 w-4 h-4" />
            Summary By Routes
          </Button>

          <Button
            onClick={() => {
              setExportDefaultType('report');
              setIsExportDialogOpen(true);
            }}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <FileText className="mr-2 w-4 h-4" />
            Export PDF
          </Button>

          {user && (user.UserType === 'Admin' || user.UserType === 'Editor') && (
            <Button
              onClick={() => openDialog('create')}
              className="bg-[#008ea2] hover:bg-[#007a8b] w-full sm:w-auto"
            >
              <Plus className="mr-2 w-4 h-4" />
              Add Franchise
            </Button>
          )}
        </div>
      </div>

      <div className="flex lg:flex-row flex-col justify-between items-baseline gap-4">
        <div className="relative w-full">
          <Input
            ref={searchInputRef}
            placeholder="Search by Applicant Name, Address, Franchise No, Plate No, etc..."
            value={searchTerm}
            onChange={(e) => {
              const target = e.target;
              const cursorPosition = target.selectionStart;
              setSearchTerm(e.target.value);

              requestAnimationFrame(() => {
                if (target && cursorPosition !== null) {
                  target.setSelectionRange(cursorPosition, cursorPosition);
                }
              });
            }}
            className="bg-white py-1 border border-gray-300 w-full"
            autoComplete="off"
          />

          {(loading.isLoading || isPending) && (
            <div className="top-1/2 right-3 absolute -translate-y-1/2">
              <div className="inline-block border-[#008ea2] border-t-2 border-r-2 border-b-transparent border-l-transparent rounded-full w-4 h-4 animate-spin"></div>
            </div>
          )}
        </div>

        <div className="flex sm:flex-row flex-col gap-2 w-full sm:w-auto">
          <select
            className="bg-white px-3 py-2 border rounded-md w-full sm:w-auto"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            disabled={isPending}
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="renew">Renewed</option>
            <option value="drop">Dropped</option>
          </select>

          <select
            className="bg-white px-3 py-2 border rounded-md w-full sm:w-auto"
            value={filterRoute}
            onChange={(e) => setFilterRoute(e.target.value)}
            disabled={isPending}
          >
            <option value="all">All Routes</option>
            {routes.map((route) => (
              <option key={route} value={route}>
                {route}
              </option>
            ))}
          </select>

          <select
            className="bg-white px-3 py-2 border rounded-md w-full sm:w-auto"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            disabled={isPending}
          >
            <option value="all">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <select
            className="bg-white px-3 py-2 border rounded-md w-full sm:w-auto"
            value={filterMake}
            onChange={(e) => setFilterMake(e.target.value)}
            disabled={isPending}
          >
            <option value="all">All Makes</option>
            {makes.map((make) => (
              <option key={make.id} value={make.id}>
                {make.Name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="gap-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row justify-between items-center space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Franchises</CardTitle>
            <Truck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.total}</div>
            <p className="text-muted-foreground text-xs">All registered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">New</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.newCount}</div>
            <p className="text-muted-foreground text-xs">Fresh registrations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Renewed</CardTitle>
            <RefreshCw className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.renewCount}</div>
            <p className="text-muted-foreground text-xs">Active renewals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Dropped</CardTitle>
            <TrendingDown className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.dropCount}</div>
            <p className="text-muted-foreground text-xs">Inactive</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Expiring Soon</CardTitle>
            <Activity className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.expiringSoon}</div>
            <p className="text-muted-foreground text-xs">Within 90 days</p>
          </CardContent>
        </Card>
      </div>

      {franchises.length > 0 ? (
        <Card className={isPending ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
          <CardHeader className="relative">
            <CardTitle>Franchise List</CardTitle>

            <div className="sm:top-4 sm:right-6 sm:absolute relative flex justify-center sm:justify-end items-center mt-4 w-auto text-gray-600 text-sm">
              <span>
                Page {pagination.current_page} of {pagination.total_pages} —{' '}
                <strong>{pagination.total}</strong> records
              </span>

              <ChevronLeft
                className={`w-6 h-6 ${
                  pagination.current_page <= 1 || isPending
                    ? 'cursor-not-allowed opacity-65'
                    : 'cursor-pointer hover:text-primary'
                }`}
                onClick={() => !isPending && handlePageChange(pagination.current_page - 1)}
              />

              <ChevronRight
                className={`w-6 h-6 ${
                  pagination.current_page >= pagination.total_pages || isPending
                    ? 'cursor-not-allowed opacity-65'
                    : 'cursor-pointer hover:text-primary'
                }`}
                onClick={() => !isPending && handlePageChange(pagination.current_page + 1)}
              />
            </div>
          </CardHeader>

          <CardContent className="!px-3 !sm:px-6 overflow-x-auto">
            <FranchiseTable
              franchises={franchises}
              onView={(f) => openDialog('view', f)}
              onEdit={(f) => openDialog('edit', f)}
              onDelete={(f) => openDialog('delete', f)}
              onRenew={(f) => openDialog('renew', f)}
              onDrop={(f) => openDialog('drop', f)}
              onFormPdf={handleFormPdf}
              onPrint={(f) => handleFormPdf(f, 'print')}
              printingId={printingId}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="p-8">
          <div className="text-center">
            <Truck className="mx-auto w-12 h-12 text-muted-foreground" />
            <h3 className="mt-4 font-medium text-lg">No franchises found</h3>
            <p className="text-muted-foreground text-sm">Try adjusting your search or filters</p>
          </div>
        </Card>
      )}

      <FranchiseFormDialog
        open={activeDialog === 'create' || activeDialog === 'edit'}
        onClose={closeDialog}
        onSave={activeDialog === 'create' ? handleCreate : handleUpdate}
        franchise={selectedFranchise}
        makes={makes}
        searchApplicants={searchApplicants}
        mode={activeDialog === 'create' ? 'create' : 'edit'}
      />

      {selectedFranchise && (
        <>
          <ViewFranchiseDialog
            open={activeDialog === 'view'}
            onClose={closeDialog}
            franchise={selectedFranchise}
            onEdit={() => openDialog('edit', selectedFranchise)}
          />

          <RenewFranchiseDialog
            open={activeDialog === 'renew'}
            onClose={closeDialog}
            franchise={selectedFranchise}
            onSuccess={handleActionSuccess}
          />

          <DropFranchiseDialog
            open={activeDialog === 'drop'}
            onClose={closeDialog}
            franchise={selectedFranchise}
            onSuccess={handleActionSuccess}
          />

          <DeleteFranchiseDialog
            open={activeDialog === 'delete'}
            onClose={closeDialog}
            franchise={selectedFranchise}
            onConfirm={handleDelete}
          />
        </>
      )}

      <ExportPdfDialog
        open={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        onExport={handleExportPdf}
        isExporting={isExporting}
        defaultType={exportDefaultType}
      />
    </motion.div>
  );
}