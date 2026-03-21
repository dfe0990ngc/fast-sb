import { createContext, useContext, useState, ReactNode, useCallback, useMemo, useRef } from 'react';
import { User, Pagination, LoadingState, UserFilters } from '../types/types';
import { useAuth } from './AuthContext';
import * as api from '../api/api';
import { isAbortError } from '../api/api';

interface UserContextType {
  users: User[];
  pagination: Pagination;
  loading: LoadingState;
  selectedUser: User | null;
  fetchUserList: (filters?: UserFilters) => Promise<{ success: boolean; message?: string; error?: string; }>;
  createUser: (userData: Partial<User>) => Promise<{ success: boolean; message?: string; error?: string; }>;
  updateUser: (id: number, userData: Partial<User>) => Promise<{ success: boolean; message?: string; error?: string; }>;
  deleteUser: (id: number) => Promise<{ success: boolean; message?: string; error?: string; }>;
  selectUser: (user: User | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    current_page: 1,
    per_page: 10,
    total: 0,
    total_pages: 1,
  });
  const [loading, setLoading] = useState<LoadingState>({ isLoading: false, error: undefined, message: undefined });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchUserList = useCallback(async (filters: UserFilters = {}): Promise<{ success: boolean; message?: string; error?: string; }> => {

    // Abort previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading((prev) => ({ ...prev, isLoading: true }));
    try {
      const query = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          query.append(key, value.toString());
        }
      });

      const { data } = await api.get(`/api/users?${query.toString()}`, {}, { track: true, requestKey: 'fetch_user_list' });

      if (data.success) {
        setUsers(data.users);
        setPagination(data.pagination);
        return { success: true, message: data.message || 'Users loaded successfully.' };
      } else {
        throw new Error(data.message || 'Failed to fetch users');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const errorMessage = (error as Error).message;
        console.error("Failed to fetch users", errorMessage);
        setUsers([]);
        setLoading({ isLoading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }
      return { success: false, message: 'Request aborted.' };
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
      setLoading((prev) => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  const createUser = useCallback(async (userData: Partial<User>): Promise<{ success: boolean; message?: string; error?: string; }> => {
    if (!user) return { success: false, error: 'Authentication token not found.' };
    setLoading({ isLoading: true });
    try {
      const response = await api.post('/api/users', userData,{ track: true, requestKey: 'create_user' });
      if (response.data.success) {
        return { success: true, message: response.data.message || 'User created successfully.' };
      } else {
        throw new Error(response.data.message || 'Failed to create user.');
      }
    } catch (error) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || (error as Error  ).message || 'An unexpected error occurred.';
      setLoading({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      setLoading({ isLoading: false });
    }
  }, [user]);

  const updateUser = useCallback(async (id: number, userData: Partial<User>): Promise<{ success: boolean; message?: string; error?: string; }> => {
    if (!user) return { success: false, error: 'Authentication token not found.' };
    setLoading({ isLoading: true });
    try {
      const response = await api.put(`/api/users/${id}`, userData, { track: true, requestKey: 'update_user' });
      if (response.data.success && response.data.user) {
        return { success: true, message: response.data.message || 'User updated successfully.' };
      } else {
        throw new Error(response.data.message || 'Failed to update user.');
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error("Failed to update user", errorMessage);
      setLoading({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      setLoading({ isLoading: false });
    }
  }, [user]);

  const deleteUser = useCallback(async (id: number): Promise<{ success: boolean; message?: string; error?: string; }> => {
    if (!user) return { success: false, error: 'Authentication token not found.' };
    setLoading({ isLoading: true });
    try {
      const response = await api.del(`/api/users/${id}`, { track: true, requestKey: 'delete_user' });
      if (response.data.success) {
        setSelectedUser(null);
        return { success: true, message: response.data.message || 'User deleted successfully.' };
      } else {
        throw new Error(response.data.message || 'Failed to delete user.');
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error("Failed to delete user", errorMessage);
      setLoading({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      setLoading({ isLoading: false });
    }
  }, [user]);

  const selectUser = useCallback((user: User | null) => {
    setSelectedUser(user);
  },[]);

  return (
    <UserContext.Provider value={useMemo(() => ({ // Memoize to prevent re-renders
        users,
        pagination,
        loading,
        selectedUser,
        fetchUserList,
        createUser,
        updateUser,
        deleteUser,
        selectUser,
      }), [users, pagination, loading, selectedUser, fetchUserList, createUser, updateUser, deleteUser, selectUser])}>
      {children}
    </UserContext.Provider>
  );
};

export const useUsers = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUsers must be used within a UserProvider');
  }
  return context;
};