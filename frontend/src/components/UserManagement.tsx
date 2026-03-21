import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react';
import DeleteUserDialog from './dialogs/DeleteUserDialog';
import UserFormDialog from './dialogs/UserFormDialog';
import UserTable from './dialogs/UserTable';
import { useUsers } from '../context/UserContext';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { User, UserFilters } from '../types/types';
import { motion } from 'framer-motion';

type DialogType = 'create' | 'edit' | 'delete' | null;

export default function UserManagement() {
  const { fetchUserList, loading, users, pagination, createUser, updateUser, deleteUser, selectedUser, selectUser } = useUsers();
  const { user } = useAuth();

  const controllerRef = useRef<AbortController | null>(null);
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [activeDialog, setActiveDialog] = useState<DialogType>(null);

  const debouncedSearch = useDebounce(searchTerm, 500);

  const loadUsers = useCallback(async (page = 1, search = debouncedSearch) => {
    // Cancel previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const filters: UserFilters = { page, limit: 10 };

      if (search) filters.search = search;

      await fetchUserList(filters);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.log('Failed to load users', error);
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, [debouncedSearch, fetchUserList]);

  // Load users when search term changes or on initial load
  useEffect(() => {
    startTransition(() => {
      loadUsers(1, debouncedSearch);
    });
  }, [debouncedSearch, loadUsers]); // loadUsers is stable due to useCallback

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.total_pages) {
      loadUsers(newPage);
    }
  };

  const openDialog = useCallback((type: DialogType, user: User | null = null) => {
    selectUser(user);
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
    setTimeout(() => selectUser(null), 150);
  };

  const handleCreate = async (data: Partial<User>) => {
    try {
      const result = await createUser(data); // This now returns a promise

      if (result.success) {
        toast.success(result.message || 'User created successfully.');

        setSearchTerm('');
        await loadUsers(pagination.current_page, debouncedSearch);

        closeDialog();
      } else {
        toast.error(result.message || result.error || 'Failed to create user.');
      }
    } catch (err) {
      const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err as Error).message || 'An unexpected error occurred.';
      toast.error(errMsg);
    }
  };

  const handleUpdate = async (data: Partial<User>) => {
    if (!selectedUser) return;
    try {
      const result = await updateUser(selectedUser.UserID, data);
      if (result.success) {
        toast.success(result.message || 'User updated successfully.');

        await loadUsers(pagination.current_page, debouncedSearch);
      } else {
        toast.error(result.message || result.error || 'Failed to update user.');
        return; // Keep dialog open on failure
      }
      closeDialog();
    } catch (err) {
      const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'An unexpected error occurred.';
      toast.error(errMsg);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      const result = await deleteUser(selectedUser.UserID);
      if (result.success) {
        toast.success(result.message || 'User deleted successfully.');

        await loadUsers(pagination.current_page, debouncedSearch);
      } else {
        toast.error(result.message || result.error || 'Failed to delete user.');
        return;
      }
      closeDialog();
    } catch (err) {
      const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'An unexpected error occurred.';
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
          <h1 className="font-medium text-lg">User Management</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage user accounts and permissions
          </p>
        </div>
        {user && user.UserType === 'Admin' && (
          <Button onClick={() => openDialog('create')} className="bg-[#008ea2] hover:bg-[#007a8b] w-full sm:w-auto">
            <Plus className="mr-2 w-4 h-4" />
            Add User
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex lg:flex-row flex-col justify-between items-baseline gap-4">
        <div className="relative w-full">
          <Input
            ref={searchInputRef}
            placeholder="Search by name or UserID..."
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

      {/* Users Table */}
      {(users?.length || 0) > 0 || isPending ? (
        <Card className={isPending ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}>
          <CardHeader className="relative">
            <CardTitle>User Accounts</CardTitle>
            {/* <CardDescription>Comprehensive overview of all system users</CardDescription> */}

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
            <UserTable
              users={users}
              onEdit={(u) => openDialog('edit', u)}
              onDelete={(u) => openDialog('delete', u)}
            />
          </CardContent>
        </Card>
      ) : !isPending && (
        <Card className="p-8">
          <div className="text-center">
            <Users className="mx-auto w-12 h-12 text-muted-foreground" />
            <h3 className="mt-4 font-medium text-lg">No users found</h3>
            <p className="text-muted-foreground text-sm">Try adjusting your search or filters</p>
          </div>
        </Card>
      )}

      {/* Dialogs */}
      <UserFormDialog
        open={activeDialog === 'create' || activeDialog === 'edit'}
        onClose={closeDialog}
        onSave={activeDialog === 'create' ? handleCreate : handleUpdate}
        user={selectedUser}
        mode={activeDialog === 'create' ? 'create' : 'edit'}
      />

      {selectedUser && (
        <>
          <DeleteUserDialog
            open={activeDialog === 'delete'}
            onClose={closeDialog}
            user={selectedUser}
            onConfirm={handleDelete}
          />
        </>
      )}
    </motion.div>
  );
}