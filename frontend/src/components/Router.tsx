import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';



// Route wrapper component for protected routes
interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('Admin' | 'Editor' | 'Viewer')[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.UserType)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};