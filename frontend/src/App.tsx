import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import { ProtectedRoute } from './components/Router';
import { GlobalDataProvider } from './context/GlobalDataProvider';
import WelcomeScreen from './components/WelcomeScreen';
import { DashboardLayout } from './components/layouts/DashboardLayout';
import { LoadingPage } from './components/ui/loading-spinner';
import { Toaster } from './components/ui/sonner';
import { NotificationProvider } from './context/NotificationContext';
import { NotificationContainer } from './components/ui/notification';
import Dashboard from './components/Dashboard';
import { useAuth } from './context/AuthContext';
import FranchiseManagement from './components/FranchiseManagement';
import MakeManagement from './components/MakeManagement';
import UserManagement from './components/UserManagement';
import Profile from './components/Profile';
import Settings from './components/Settings';
import ApplicantManagement from './components/ApplicantManagement';

// Unauthorized page component
function UnauthorizedPage() {
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="space-y-6 text-center">
        <div className="text-8xl">🚫</div>
        <h2 className="font-bold text-3xl">Access Denied</h2>
        <p className="text-muted-foreground text-xl">
          You don't have permission to access this page.
        </p>
      </div>
    </div>
  );
}

// Not found page component
function NotFoundPage() {
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="space-y-6 text-center">
        <div className="text-8xl">🚧</div>
        <h2 className="font-bold text-3xl">Page Not Found</h2>
        <p className="text-muted-foreground text-xl">
          The page you're looking for doesn't exist.
        </p>
      </div>
    </div>
  );
}

// Layout wrapper for authenticated routes
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const currentPage = location.pathname.split('/').pop() || 'dashboard';
  
  return (
    <DashboardLayout currentPage={currentPage}>
      <Suspense fallback={<LoadingPage text="Loading page..." />}>
        {children}
      </Suspense>
    </DashboardLayout>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  // CRITICAL: Show loading state while checking authentication
  // This prevents route rendering before auth check completes
  if (isLoading) {
    return <LoadingPage text="Checking authentication..." />;
  }

  // If not authenticated, show welcome/login screen
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/login" element={<WelcomeScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Authenticated routes with dashboard layout
  return (
    <AuthenticatedLayout>
      <Routes>
        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />

        {/* Dashboard Routes - All authenticated users */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Editor', 'Viewer']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/franchises"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Editor', 'Viewer']}>
              <FranchiseManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/makes"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Editor', 'Viewer']}>
              <MakeManagement />
            </ProtectedRoute>
          }
        />

        {/* Admin only route */}
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['Admin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-profile"
          element={
            <ProtectedRoute allowedRoles={['Admin', 'Editor', 'Viewer']}>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['Admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/applicants"
          element={
            <ProtectedRoute allowedRoles={['Admin','Editor','Viewer']}>
              <ApplicantManagement />
            </ProtectedRoute>
          }
        />

        {/* Error pages */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthenticatedLayout>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <GlobalDataProvider>
        <AppRoutes />
      </GlobalDataProvider>
      <Toaster />
      <NotificationContainer />
    </NotificationProvider>
  );
}