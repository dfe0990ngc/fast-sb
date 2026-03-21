import { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { MakeProvider } from './MakesContext';
import { FranchiseProvider } from './FranchiseContext';
import { UserProvider } from './UserContext';

interface GlobalDataProviderProps {
  children: ReactNode;
}

/**
 * GlobalDataProvider combines all context providers for the LMS application.
 * This ensures all academic data is available throughout the application hierarchy.
 * 
 * Order of providers is important:
 * 1. AuthProvider - Must be outermost for authentication state
 */
export const GlobalDataProvider = ({ children }: GlobalDataProviderProps) => {
  return (
    <AuthProvider>
      <UserProvider>
      <FranchiseProvider>
        <MakeProvider>
        {children}
        </MakeProvider>
      </FranchiseProvider>
      </UserProvider>
    </AuthProvider>
  );
};
