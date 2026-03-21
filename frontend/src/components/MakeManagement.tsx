import { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Plus, Truck } from 'lucide-react';
import DeleteMakeDialog from './dialogs/DeleteMakeDialog';
import MakeFormDialog from './dialogs/MakeFormDialog';
import MakeTable from './dialogs/MakeTable';
import { useMakes } from '../context/MakesContext';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { MakeFilters } from '../types/types';
import { motion } from 'framer-motion';

export default function MakeManagement() {
  const { fetchMakeList, loading, makes, pagination, createMake, updateMake, deleteMake } = useMakes();
  const { user } = useAuth();

  const controllerRef = useRef<AbortController | null>(null);
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [activeDialog, setActiveDialog] = useState(null);
  const [selectedMake, setSelectedMake] = useState(null);

  const debouncedSearch = useDebounce(searchTerm, 500);

  // Load franchises when filters or search change
  useEffect(() => {
    startTransition(() => {
      loadMakes(1);
    });
  }, [debouncedSearch]);

  const loadMakes = async (page = 1) => {
    // Cancel previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const filters: MakeFilters = { page, limit: 10 };

      if (debouncedSearch) filters.search = debouncedSearch;

      await fetchMakeList(filters);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.log('Failed to load makes', error);
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.total_pages) {
      loadMakes(newPage);
    }
  };

  const openDialog = useCallback((type, make = null) => {
    setSelectedMake(make);
    setActiveDialog(type);
  },[]);

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
    setTimeout(() => setSelectedMake(null), 150);
  };

  const handleCreate = async (data) => {
    try {
      const result = await createMake(data);
      if (result.success) {
        toast.success(result.message || 'Make created successfully.');
      } else {
        toast.error(result.message || 'Failed to create make.');
      }
      closeDialog();
    } catch (err) {
      const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err as Error).message || 'An unexpected error occurred.';
      toast.error(errMsg);
    }
  };

  const handleUpdate = async (data) => {
    if (!selectedMake) return;
    try {
      const result = await updateMake(selectedMake.id, data);
      if (result.success) {
        toast.success(result.message || 'Make updated successfully.');
      } else {
        toast.error(result.message || 'Failed to update make.');
        return;
      }
      closeDialog();
    } catch (err) {
      const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err as Error).message || 'An unexpected error occurred.';
      toast.error(errMsg);
    }
  };

  const handleDelete = async () => {
    if (!selectedMake) return;
    try {
      const result = await deleteMake(selectedMake.id);
      if (result.success) {
        toast.success(result.message || 'Make deleted successfully.');
      } else {
        toast.error(result.message || 'Failed to delete make.');
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
          <h1 className="font-medium text-lg">Vehicle Brand Management</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage vehicle brand records and track updates
          </p>
        </div>
        {user && (user.UserType === 'Admin' || user.UserType === 'Editor') && (
          <Button onClick={() => openDialog('create')} className="bg-[#008ea2] hover:bg-[#007a8b] w-full sm:w-auto">
            <Plus className="mr-2 w-4 h-4" />
            Add Make
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex lg:flex-row flex-col justify-between items-baseline gap-4">
        <div className="relative w-full">
          <Input
            ref={searchInputRef}
            placeholder="Search by make name..."
            value={searchTerm}
            onChange={(e) => {
              const target = e.target;
              const cursorPosition = target.selectionStart;
              setSearchTerm(e.target.value);
              // Restore cursor position after state update
              requestAnimationFrame(() => {
                if (target) {
                  target.setSelectionRange(cursorPosition, cursorPosition);
                }
              });
            }}
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

      {/* Franchises Table */}
      {makes.length > 0 || isPending ? (
        <Card className={isPending ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}>
          <CardHeader className="relative">
            <CardTitle>Vehicle Brand Details</CardTitle>
            {/* <CardDescription>Comprehensive overview of all Vehicle Brands</CardDescription> */}

            {/* Pagination */}
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
            <MakeTable
              makes={makes}
              onEdit={(f) => openDialog('edit', f)}
              onDelete={(f) => openDialog('delete', f)}
            />
          </CardContent>
        </Card>
      ) : !isPending && (
        <Card className="p-8">
          <div className="text-center">
            <Truck className="mx-auto w-12 h-12 text-muted-foreground" />
            <h3 className="mt-4 font-medium text-lg">No franchises found</h3>
            <p className="text-muted-foreground text-sm">Try adjusting your search or filters</p>
          </div>
        </Card>
      )}

      {/* Dialogs */}
      <MakeFormDialog
        open={activeDialog === 'create' || activeDialog === 'edit'}
        onClose={closeDialog}
        onSave={activeDialog === 'create' ? handleCreate : handleUpdate}
        make={selectedMake}
        makes={makes}
        mode={activeDialog === 'create' ? 'create' : 'edit'}
      />

      {selectedMake && (
        <>

          <DeleteMakeDialog
            open={activeDialog === 'delete'}
            onClose={closeDialog}
            make={selectedMake}
            onConfirm={handleDelete}
          />
        </>
      )}
    </motion.div>
  );
}