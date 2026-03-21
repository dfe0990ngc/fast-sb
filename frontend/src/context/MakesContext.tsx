import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { Make, MakeContextType, LoadingState, Pagination, MakeFilters } from '../types/types';
import * as api from '../api/api';
import { isAbortError } from '../api/api';
import { useAuth } from './AuthContext';

// Create Context
const MakeContext = createContext<MakeContextType | null>(null);

// Custom Hook
export const useMakes = () => {
  const context = useContext(MakeContext);
  if (!context) {
    throw new Error('useMakes must be used within an MakeProvider');
  }
  return context;
};

interface MakeProviderProps {
  children: ReactNode;
}

const DEFAULT_PAGINATION: Pagination = {current_page: 1, per_page: 10, total: 0, total_pages: 1 };

export const MakeProvider = ({ children }: MakeProviderProps) => {
  const { user } = useAuth();
  const [makes, setMakes] = useState<Make[]>([]);
  const [selectedMake, setSelectedMake] = useState<Make | null>(null);
  const [loading, setLoading] = useState<LoadingState>({ isLoading: false, error: undefined });
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);

  // Initialize data on mount  
  const fetchMakes = useCallback(async (): Promise<{success: boolean, message?: string, error?: string}> => {
    if(!user) return { success: false, message: 'User not authenticated'} 

    setLoading({ isLoading: true, error: undefined });
    try {
      const { data } = await api.get('/api/makes', {}, { track: true, requestKey: 'fetch_makes' });

      if(data.success){
        setMakes(data?.makes || []);

        return { success: true, message: 'Makes have been loaded successfully' };
      }else{
        throw new Error(data.message || 'Failed to fetch makes');
      }

    } catch (error: unknown) {
      if (!isAbortError(error)) {
        const message = (error as any)?.response?.data?.message || ( error instanceof Error ? error.message : 'Failed to fetch makes' );
        setLoading(prev => ({ ...prev, error: message }));
        return { success: false, message };
      }
      return { success: false, message: 'Request aborted' };
    } finally {
      setLoading(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  useEffect(() => {
    if(user){
      fetchMakes();
    }
  }, [user, fetchMakes]);

  const fetchMakeList = useCallback(async (filters: MakeFilters = {}): Promise<{success: boolean, message?: string, error?: string}> => {
    if(!user) return { success: false, message: 'User not authenticated'} 

    setLoading({ isLoading: true, error: undefined });

    try {
      // Construct query params from filters
      const query = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query.append(key, String(value));
        }
      });

      const { data } = await api.get(`/api/make-list?${query.toString()}`, {}, { track: true, requestKey: 'fetch_make_list' });

      if(data.success){
        setMakes(data?.makes || []);
        setPagination(data?.pagination || DEFAULT_PAGINATION);
    
        return { success: true, message: 'Makes have been loaded successfully' };
      }else{
        throw new Error(data.message || 'Failed to fetch list of makes');
      }
    } catch (error: unknown) {
      if (!isAbortError(error)) {
        const message = (error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'Failed to fetch makes');
        setLoading(prev => ({ ...prev, error: message }));
        return { success: false, message };
      }

      return { success: false, message: 'Request aborted' };
    } finally {
      setLoading(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  const createMake = useCallback(async (makeData: Omit<Make, 'id'>): Promise<{success: boolean, message?: string, error?: string}> => {
    
    setLoading({ isLoading: true, error: undefined });
    try {
      const { data } = await api.post('/api/makes', makeData, {}, { track: true, requestKey: `create_make` });
      const { make: newMake } = data;

      if(data.success){
      
        setMakes(prev => [...prev, newMake]);
        return {success: true,message: 'Make has been created successfully'};
      
      }else{
        throw new Error(data.message || 'Failed to create make');
      }
    } catch (error: unknown) {
      if (!isAbortError(error)) {
        const message = (error as any)?.response?.data?.message || ( error instanceof Error ? error.message : 'Failed to create record');
        setLoading(prev => ({ ...prev, error: message }));
        return {success: false,message: message};
      }
      return {success: false,message: 'Request aborted'};
    } finally {
      setLoading(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const updateMake = useCallback(async (id: number, updates: Partial<Make>): Promise<{success: boolean, message?: string, error?: string}> => {
    
    setLoading({ isLoading: true, error: undefined });
    try {
      const { data } = await api.put(`/api/makes/${id}`, updates, {}, { track: true, requestKey: `update_make` });
      const { make: updatedMake, message } = data;

      if(data.success){
        setMakes((prev: Make[]) => prev.map(make => make.id === id ? ({ ...make, ...updatedMake }) : make ));
        setSelectedMake(prev => prev?.id === id ? ({ ...prev, ...updatedMake }) : prev);
        return { success: true, message: message || 'Record has been updated successfully' };
      }else{
        throw new Error(data.message || 'Failed to update make');
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

  const deleteMake = useCallback(async (id: number): Promise<{success: boolean, message?: string, error?: string}> => {
    setLoading({ isLoading: true, error: undefined });
    try {
      const { data } = await api.del(`/api/makes/${id}`, {}, { track: true, requestKey: `delete_make`});
      
      if(data.success){
        setMakes((prev: Make[]) => prev.filter(make => make.id !== id));

        if (selectedMake?.id === id) {
          setSelectedMake(null);
        }

        return { success: true, message: data?.message || "Record has been deleted successfully" };
      }else{
        throw new Error(data.message || 'Failed to delete make');
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
  }, []);

  const selectMake = useCallback((make: Make | undefined): void => {
    setSelectedMake(make);
  }, []);

  const getMakeById = useCallback((id: number): Make | undefined => {
    return makes.find((make: Make) => make.id === id);
  }, [makes]);

  const contextValue: MakeContextType = useMemo(() => ({
      makes,
      loading,
      selectedMake,
      pagination,
      fetchMakes,
      fetchMakeList,
      createMake,
      updateMake,
      deleteMake,
      selectMake,
      getMakeById
  }), [makes, loading, selectedMake, pagination, fetchMakes, fetchMakeList, createMake, updateMake, deleteMake, selectMake, getMakeById]);

  return (
    <MakeContext.Provider value={contextValue}>
      {children}
    </MakeContext.Provider>
  );
};
