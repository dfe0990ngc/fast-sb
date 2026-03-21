import { useState, createContext, useContext, ReactNode, useEffect, useRef } from 'react';
import { LoadingOverlay } from '../components/ui/loading-spinner';
import { User } from '../types/types';
import * as api from '../api/api.js';

interface AuthContextType {
  user: User | null;
  available_years: number[];
  setAvailableYears: React.Dispatch<React.SetStateAction<number[]>>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  showAuth: boolean;
  loginData: { UserID: string; Password?: string };
  setLoginData: React.Dispatch<React.SetStateAction<{ UserID: string; Password?: string }>>;
  setShowAuth: React.Dispatch<React.SetStateAction<boolean>>;
  cancelPendingRequests: () => void;
}

// Context
const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [available_years, setAvailableYears] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true); // ✅ START AS TRUE
  const [isAuthenticating, setIsAuthenticating] = useState(false); // For login/logout operations
  const [showAuth, setShowAuth] = useState(false);
  const [loginData, setLoginData] = useState({ UserID: '', Password: '' });
  const authControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Check for existing user session on mount
    const checkAuth = () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser.user);
          if (parsedUser.available_years) {
            setAvailableYears(parsedUser.available_years);
          }
        }
      } catch (error) {
        console.error('Failed to restore user session:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      } finally {
        // ✅ ALWAYS set isLoading to false after check
        setIsLoading(false);
      }
    };

    checkAuth();
    
    // Cleanup function to cancel any pending requests
    return () => {
      if (authControllerRef.current) {
        authControllerRef.current.abort();
      }
    };
  }, []); // ✅ Empty deps - run only once on mount

  const login = async (UserID: string, Password: string) => {
    // Cancel any existing auth request
    if (authControllerRef.current) {
      authControllerRef.current.abort();
    }
    
    // Create new controller for this request
    authControllerRef.current = new AbortController();
    const signal = authControllerRef.current.signal;
    
    setIsAuthenticating(true);
    try {
      // Make real API call for login
      const response = await api.login({ UserID, Password }, signal);
      
      if (response.data?.user) {
        setUser(response.data.user);
        setAvailableYears(response.data.available_years || []);
        // Persist user data
        const sessionData = { user: response.data.user, available_years: response.data.available_years };
        localStorage.setItem('user', JSON.stringify(sessionData));
        
        setLoginData((prev) => ({...prev,UserID:'',Password:''}));
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      if (!api.isAbortError(error)) {
        console.error('Login failed:', error);
        throw error instanceof Error ? error : new Error('Login failed');
      }
      // If request was aborted, don't throw error
    } finally {
      setIsAuthenticating(false);
      authControllerRef.current = null;
    }
  };

  const logout = async () => {
    // Cancel any existing auth request
    if (authControllerRef.current) {
      authControllerRef.current.abort();
    }
    
    // Create new controller for this request
    authControllerRef.current = new AbortController();
    const signal = authControllerRef.current.signal;
    
    setIsAuthenticating(true);
    try {
      // Make real API call for logout
      await api.logout(signal);
    } catch (error) {
      if (!api.isAbortError(error)) {
        console.error('Logout API call failed:', error);
        // Continue with local logout even if API fails
      }
    } finally {
      // Always clear local state and storage
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      setUser(null);
      setAvailableYears([]);
      setIsAuthenticating(false);
      authControllerRef.current = null;
      
      // Cancel any other pending requests when logging out
      api.cancelAllRequests();
    }
  };

  const cancelPendingRequests = () => {
    if (authControllerRef.current) {
      authControllerRef.current.abort();
      authControllerRef.current = null;
    }
  };

  // Show loading overlay for authentication operations (login/logout)
  // but NOT for initial auth check (isLoading)
  const showLoadingOverlay = isAuthenticating;

  return (
    <AuthContext.Provider value={{ 
      user, 
      available_years,
      setAvailableYears,
      setUser, 
      login, 
      logout, 
      isLoading: isLoading || isAuthenticating, // ✅ Return true if either is loading
      showAuth,
      loginData,
      setLoginData,
      setShowAuth,
      cancelPendingRequests 
    }}>
      <LoadingOverlay isVisible={showLoadingOverlay} text="Processing..." />
      {children}
    </AuthContext.Provider>
  );
};