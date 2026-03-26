import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/shared/store/authStore';
import { Loader } from '@/components/retroui/Loader.jsx';

function GuardLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Loader />
    </div>
  );
}

// Must be logged in
export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) return <GuardLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// Must be VENDOR or ADMIN
export function AdminRoute({ children }) {
  const { isAuthenticated, isLoading, isVendorOrAdmin } = useAuthStore();
  const location = useLocation();

  if (isLoading) return <GuardLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isVendorOrAdmin()) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Must be ADMIN only
export function AdminOnlyRoute({ children }) {
  const { isAuthenticated, isLoading, isAdmin } = useAuthStore();
  const location = useLocation();

  if (isLoading) return <GuardLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Redirect away if already logged in
export function GuestRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return <GuardLoader />;

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}
