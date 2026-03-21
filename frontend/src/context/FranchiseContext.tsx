import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { LoadingState, FranchiseContextType, Franchise, Pagination, FranchiseFilters } from '../types/types';
import * as api from '../api/api';
import { isAbortError } from '../api/api';
import { useAuth } from './AuthContext';

// Create Context
const FranchiseContext = createContext<FranchiseContextType | null>(null);

// Custom Hook
export const useFranchise = () => {
  const context = useContext(FranchiseContext);
  if (!context) {
    throw new Error('useFranchise must be used within an FranchiseProvider');
  }
  return context;
};

interface FranchiseProviderProps {
  children: ReactNode;
}

const DEFAULT_PAGINATION: Pagination = { current_page: 1, per_page: 10, total: 0, total_pages: 1 };

export const FranchiseProvider = ({ children }: FranchiseProviderProps) => {
  const { user } = useAuth();
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);
  const [statistics, setStatistics] = useState<any>({});
  const [selectedFranchise, setSelectedFranchise] = useState<Franchise | null>(null);
  const [loading, setLoading] = useState<LoadingState>({ isLoading: false, error: undefined });

  const fetchStatistics = useCallback(async (year: number): Promise<{ success: boolean; message?: string; error?: string }> => {
    setLoading({ isLoading: true, error: undefined });
    try {
      const { data } = await api.get(`/api/franchises/statistics/${year}`, {}, { track: true, requestKey: 'fetch_franchises_statistics' });
      if (data.success) {
        setStatistics(data);
        return { success: true, message: 'Franchise Statistics have been loaded successfully' };
      } else {
        throw new Error(data.message || 'Failed to fetch statistics');
      }
    } catch (error: unknown) {
      if (!isAbortError(error)) {
        const message = (error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'Failed to fetch statistics');
        setLoading((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }
      return { success: false, message: 'Request aborted' };
    } finally {
      setLoading((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const fetchFranchises = useCallback(async (
    filters: FranchiseFilters = {}
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    setLoading({ isLoading: true, error: undefined });
    try {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query.append(key, String(value));
        }
      });

      const { data } = await api.get(`/api/franchises?${query.toString()}`, {}, { track: true, requestKey: 'fetch_franchises' });
      if (data.success) {
        setFranchises(data?.franchises || []);
        setPagination(data?.pagination || DEFAULT_PAGINATION);
        return { success: true, message: 'Franchises have been loaded successfully' };
      } else {
        throw new Error(data.message || 'Failed to fetch franchises');
      }
    } catch (error: unknown) {
      if (!isAbortError(error)) {
        const message = (error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'Failed to fetch franchises');
        setLoading((prev) => ({ ...prev, error: message }));
        return { success: false, message };
      }
      return { success: false, message: 'Request aborted' };
    } finally {
      setLoading((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Initialize data on mount
  useEffect(() => {
    if (user) {
      fetchStatistics(0);
      fetchFranchises();
    }
  }, [user, fetchFranchises, fetchStatistics]);

  const createFranchise = useCallback(async (franchiseData: Omit<Franchise, 'id'>): Promise<{success: boolean, message?: string, error?: string}> => {
    setLoading({ isLoading: true, error: undefined });
    try {
      const { data } = await api.post('/api/franchises', franchiseData, {}, { track: true, requestKey: `create_franchise` });
      if (data.success) {
        const { franchise: newFranchise } = data;
        setFranchises(prev => [...prev, newFranchise]);
        return {success: true,message: 'Franchise has been created successfully'};
      } else {
        throw new Error(data.message || 'Failed to create franchise');
      }
    } catch (error: unknown) {
      if (!isAbortError(error)) {
        const message = (error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'Failed to create record');
        setLoading(prev => ({ ...prev, error: message }));
        return {success: false,message: message};
      }
      return {success: false,message: 'Request aborted'};
    } finally {
      setLoading(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const updateFranchise = useCallback(async (id: number, updates: Partial<Franchise>): Promise<{success: boolean, message?: string, error?: string}> => {
    setLoading({ isLoading: true, error: undefined });
    try {
      const { data } = await api.put(`/api/franchises/${id}`, updates, {}, { track: true, requestKey: `update_franchise_${id}` });
      if (data.success) {
        const { franchise: updatedFranchise, message } = data;
        setFranchises((prev: Franchise[]) => prev.map(franchise => franchise.id === id ? updatedFranchise : franchise ));
        if (selectedFranchise?.id === id) {
          setSelectedFranchise(updatedFranchise);
        }
        return { success: true, message: message || 'Record has been updated successfully' };
      } else {
        throw new Error(data.message || 'Failed to update franchise');
      }
    } catch (error: unknown) {
      if (!isAbortError(error)) {
        const message = (error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'Failed to update record');
        setLoading(prev => ({ ...prev, error: message }));
        return { success: false, message }
      }
      return { success: false, message: 'Request aborted' };
    } finally {
      setLoading(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const deleteFranchise = useCallback(async (id: number): Promise<{success: boolean, message?: string, error?: string}> => {
    setLoading({ isLoading: true, error: undefined });
    try {
      const { data } = await api.del(`/api/franchises/${id}`, {}, { track: true, requestKey: `delete_franchise_${id}`});
      if (data.success) {
        setFranchises((prev: Franchise[]) => prev.filter(franchise => franchise.id !== id));
        if (selectedFranchise?.id === id) {
          setSelectedFranchise(null);
        }
        return { success: true, message: data?.message || "Record has been deleted successfully" };
      } else {
        throw new Error(data.message || 'Failed to delete franchise');
      }
    } catch (error: unknown) {
      if (!isAbortError(error)) {
        const message = (error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'Failed to delete record');
        setLoading(prev => ({ ...prev, error: message }));
        return { success: false, error: message, };
      }
      return { success: false, error: 'Request aborted', };
    } finally {
      setLoading(prev => ({ ...prev, isLoading: false }));
    }
  }, [selectedFranchise]);

  const selectFranchise = useCallback((franchise: Franchise | undefined): void => {
    setSelectedFranchise(franchise);
  }, []);

  const getFranchiseById = useCallback((id: number): Franchise | undefined => {
    return franchises.find((franchise: Franchise) => franchise.id === id);
  }, [franchises]);

  const contextValue: FranchiseContextType = useMemo(() => ({
    franchises,
    loading,
    selectedFranchise,
    pagination,
    statistics,
    fetchFranchises,
    fetchStatistics,
    createFranchise,
    updateFranchise,
    deleteFranchise,
    selectFranchise,
    getFranchiseById
  }), [franchises, loading, selectedFranchise, pagination, statistics, fetchFranchises, fetchStatistics, createFranchise, updateFranchise, deleteFranchise, selectFranchise, getFranchiseById]);

  return (
    <FranchiseContext.Provider value={contextValue}>
      {children}
    </FranchiseContext.Provider>
  );
};
