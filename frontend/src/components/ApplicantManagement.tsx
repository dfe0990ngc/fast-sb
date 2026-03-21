import { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, Truck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { Applicant, Pagination } from '../types/types';
import * as api from '../api/api';
import ApplicantTable from './dialogs/ApplicantTable';
import ApplicantFormDialog from './dialogs/ApplicantFormDialog';
import ViewApplicantDialog from './dialogs/ViewApplicantDialog';
import DeleteApplicantDialog from './dialogs/DeleteApplicantDialog';
import { motion } from 'framer-motion';

export default function ApplicantManagement() {
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ current_page: 1, per_page: 10, total: 0, total_pages: 1 });

  const [searchTerm, setSearchTerm] = useState('');
  const [activeDialog, setActiveDialog] = useState<'view' | 'create' | 'edit' | 'delete' | null>(null);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(searchTerm, 500);

  const loadApplicants = useCallback(async (page = 1, isInitialLoad = false) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const response = await api.get(`/api/applicants?${params.toString()}`);
      if (response.data.success) {
        if (isInitialLoad) {
          setApplicants(response.data.applicants);
        } else {
          startTransition(() => {
            setApplicants(response.data.applicants);
          });
        }
        setPagination(response.data.pagination);
      }
    } catch (error: any) {
      toast.error('Failed to load applicants.');
    }
  }, [debouncedSearch]);

  useEffect(() => {
    startTransition(() => {
      loadApplicants(1);
    });
  }, [debouncedSearch]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.total_pages) {
      loadApplicants(newPage);
    }
  };

  const openDialog = useCallback((type: 'view' | 'create' | 'edit' | 'delete', applicant: Applicant | null = null) => {
    setSelectedApplicant(applicant);
    setActiveDialog(type);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Alt+1 to open create dialog
      if (event.altKey && event.key === '1') {
        event.preventDefault();
        openDialog('create');
      }

      // Ctrl+F to focus search
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
    setTimeout(() => setSelectedApplicant(null), 150);
  };

  const handleCreate = async (data: Partial<Applicant>) => {
    try {
      const response = await api.post('/api/applicants', data);
      if (response.data.success) {
        toast.success('Applicant created successfully.');
        loadApplicants(1);
      } else {
        toast.error(response.data.message || 'Failed to create applicant.');
        return;
      }
      closeDialog();
    } catch (err) {
      const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err as Error).message || 'An unexpected error occurred.';
      toast.error(errMsg);
    }
  };

  const handleUpdate = async (data: Partial<Applicant>) => {
    if (!selectedApplicant) return;
    try {
      const response = await api.put(`/api/applicants/${selectedApplicant.id}`, data);
      if (response.data.success) {
        toast.success('Applicant updated successfully.');
        loadApplicants(pagination.current_page);
      } else {
        toast.error(response.data.message || 'Failed to update applicant.');
      }
      closeDialog();
    } catch (err) {
      const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err as Error).message || 'An unexpected error occurred.';
      toast.error(errMsg);
    }
  };

  const handleDelete = async () => {
    if (!selectedApplicant) return;
    try {
      const response = await api.del(`/api/applicants/${selectedApplicant.id}`);
      if (response.data.success) {
        toast.success('Applicant deleted successfully.');
        loadApplicants(pagination.current_page > 1 && applicants.length === 1 ? pagination.current_page - 1 : pagination.current_page);
      } else {
        toast.error(response.data.message || 'Failed to delete applicant.');
      }
      closeDialog();
    } catch (err) {
      const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err as Error).message || 'An unexpected error occurred.';
      toast.error(errMsg);
    }
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1
      }}
      transition={{
        delay: 0.1,
        duration: 0.25,
        type: 'tween',
      }}    
      className="space-y-4 p-0 sm:p-4">
      
      {/* Header */}
      <div className="relative flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
        <div className="-top-8 right-0 absolute font-mono text-[11px]">
          <span>New: <strong className="font-extrabold">[Alt + 1]</strong></span>&nbsp; 
          <span>Search: <strong className="font-extrabold">[Ctrl + F]</strong></span>
        </div>
        <div>
          <h1 className="font-medium text-lg">Applicant Management</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage franchise applicants and owners</p>
        </div>
        {user && (user.UserType === 'Admin' || user.UserType === 'Editor') && (
          <Button onClick={() => openDialog('create')} className="bg-[#008ea2] hover:bg-[#007a8b] w-full sm:w-auto">
            <Plus className="mr-2 w-4 h-4" />
            Add Applicant
          </Button>
        )}
      </div>

      <div className="flex lg:flex-row flex-col justify-between items-baseline gap-4">
        <div className="relative w-full">
          <Input
            ref={searchInputRef}
            placeholder="Search by name or contact number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-white py-1 border border-gray-300 w-full"
            autoComplete="off"
          />
          {isPending && (
            <div className="top-1/2 right-3 absolute -translate-y-1/2">
              <div className="inline-block border-[#008ea2] border-t-2 border-r-2 border-b-transparent border-l-transparent rounded-full w-4 h-4 animate-spin"></div>
            </div>
          )}
        </div>
      </div>

      {applicants.length > 0 || isPending ? (
        <Card className={isPending ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}>
          <CardHeader className="relative">
            <CardTitle>Applicant List</CardTitle>
            <div className="sm:top-4 sm:right-6 sm:absolute relative flex justify-center sm:justify-end items-center mt-4 w-auto text-gray-600 text-sm">
              <span>
                Page {pagination.current_page} of {pagination.total_pages} — <strong>{pagination.total}</strong> records
              </span>
              <ChevronLeft 
                className={`w-6 h-6 ${pagination.current_page <= 1 || isPending ? 'cursor-not-allowed opacity-65' : 'cursor-pointer hover:text-primary'}`} 
                onClick={() => !isPending && handlePageChange(pagination.current_page - 1)}
              />
              <ChevronRight 
                className={`w-6 h-6 ${pagination.current_page >= pagination.total_pages || isPending ? 'cursor-not-allowed opacity-65' : 'cursor-pointer hover:text-primary'}`} 
                onClick={() => !isPending && handlePageChange(pagination.current_page + 1)}
              />
            </div>
          </CardHeader>
          <CardContent className="!px-3 !sm:px-6 overflow-x-auto">
            <ApplicantTable
              applicants={applicants}
              onView={(a) => openDialog('view', a)}
              onEdit={(a) => openDialog('edit', a)}
              onDelete={(a) => openDialog('delete', a)}
            />
          </CardContent>
        </Card>
      ) : !isPending && (
        <Card className="p-8">
          <div className="text-center">
            <User className="mx-auto w-12 h-12 text-muted-foreground" />
            <h3 className="mt-4 font-medium text-lg">No applicants found</h3>
            <p className="text-muted-foreground text-sm">Try adjusting your search or click "Add Applicant"</p>
          </div>
        </Card>
      )}

      {/* Dialogs */}
      <ApplicantFormDialog
        open={activeDialog === 'create' || activeDialog === 'edit'}
        onClose={closeDialog}
        onSave={activeDialog === 'create' ? handleCreate : handleUpdate}
        applicant={selectedApplicant}
        mode={activeDialog === 'create' ? 'create' : 'edit'}
      />

      {selectedApplicant && (
        <>
          <ViewApplicantDialog
            open={activeDialog === 'view'}
            onClose={closeDialog}
            onEdit={() => openDialog('edit', selectedApplicant)}
            applicantId={selectedApplicant.id}
          />
          <DeleteApplicantDialog
            open={activeDialog === 'delete'}
            onClose={closeDialog}
            applicant={selectedApplicant}
            onConfirm={handleDelete}
          />
        </>
      )}
    </motion.div>
  );
}