import { lazy, Suspense } from 'react';
import { Loader } from '@/components/retroui/Loader.jsx';
import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute, AdminRoute, AdminOnlyRoute, GuestRoute } from './guards';

// Layouts (loaded eagerly - they wrap everything)
import PublicLayout from '@/app/layouts/PublicLayout';
import AdminLayout from '@/app/layouts/AdminLayout';
import AuthLayout from '@/app/layouts/AuthLayout';
import LandingPage from '@/modules/landing/pages/LandingPage';

// Lazy-loaded pages
const EventsPage = lazy(() => import('@/modules/events/pages/EventsPage'));
const EventDetailPage = lazy(() => import('@/modules/events/pages/EventDetailPage'));

const LoginPage = lazy(() => import('@/modules/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/modules/auth/pages/RegisterPage'));
const VerifyEmailPage = lazy(() => import('@/modules/auth/pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('@/modules/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/modules/auth/pages/ResetPasswordPage'));

const DashboardPage = lazy(() => import('@/modules/dashboard/pages/DashboardPage'));
const OverviewPage = lazy(() => import('@/modules/dashboard/pages/OverviewPage'));
const ProfilePage = lazy(() => import('@/modules/auth/pages/ProfilePage'));
const PaymentPendingPage = lazy(() => import('@/modules/payments/pages/PaymentPendingPage'));

const ApplyPage = lazy(() => import('@/modules/vendor-application/pages/ApplyPage'));
const MyApplicationPage = lazy(() => import('@/modules/vendor-application/pages/MyApplicationPage'));

const EventListPage = lazy(() => import('@/modules/event-management/pages/EventListPage'));
const EventFormPage = lazy(() => import('@/modules/event-management/pages/EventFormPage'));
const AttendeesPage = lazy(() => import('@/modules/attendees/pages/AttendeesPage'));
const CheckInPage = lazy(() => import('@/modules/attendees/pages/CheckInPage'));
const BudgetPage = lazy(() => import('@/modules/finance/pages/BudgetPage'));

const VenueManagementPage = lazy(() => import('@/modules/venues/pages/VenueManagementPage'));
const ViewVenuesPage = lazy(() => import('@/modules/venues/pages/ViewVenuesPage'));
const UserManagementPage = lazy(() => import('@/modules/admin-users/pages/UserManagementPage'));
const AdminReviewPage = lazy(() => import('@/modules/vendor-application/pages/AdminReviewPage'));
const VendorOverviewPage = lazy(() => import('@/modules/finance/pages/VendorOverviewPage'));
const AdminOverviewPage = lazy(() => import('@/modules/finance/pages/AdminOverviewPage'));
const EventReportsPage = lazy(() => import('@/modules/finance/pages/EventReportsPage'));

// Suspense fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader />
    </div>
  );
}

function S({ children }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

// Router
const router = createBrowserRouter([
  // Public routes
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/events', element: <S><EventsPage /></S> },
      { path: '/events/:id', element: <S><EventDetailPage /></S> },
    ],
  },

  // Auth routes
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <GuestRoute><S><LoginPage /></S></GuestRoute> },
      { path: '/register', element: <GuestRoute><S><RegisterPage /></S></GuestRoute> },
      { path: '/verify-email', element: <S><VerifyEmailPage /></S> },
      { path: '/forgot-password', element: <GuestRoute><S><ForgotPasswordPage /></S></GuestRoute> },
      { path: '/reset-password', element: <GuestRoute><S><ResetPasswordPage /></S></GuestRoute> },
    ],
  },

  // Protected user routes
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/dashboard',
        element: <ProtectedRoute><S><DashboardPage /></S></ProtectedRoute>,
      },
      {
        path: '/profile',
        element: <ProtectedRoute><S><ProfilePage /></S></ProtectedRoute>,
      },
      {
        path: '/payments/pending',
        element: <ProtectedRoute><S><PaymentPendingPage /></S></ProtectedRoute>,
      },
      {
        path: '/vendor/apply',
        element: <ProtectedRoute><S><ApplyPage /></S></ProtectedRoute>,
      },
      {
        path: '/vendor/applications/me',
        element: <ProtectedRoute><S><MyApplicationPage /></S></ProtectedRoute>,
      },
    ],
  },

  // Admin / Vendor routes
  {
    element: <AdminRoute><AdminLayout /></AdminRoute>,
    children: [
      { path: '/admin', element: <S><OverviewPage /></S> },
      { path: '/admin/events', element: <S><EventListPage /></S> },
      { path: '/admin/events/new', element: <S><EventFormPage /></S> },
      { path: '/admin/events/:id/edit', element: <S><EventFormPage /></S> },
      { path: '/admin/check-in', element: <S><CheckInPage /></S> },
      { path: '/admin/events/:id/attendees', element: <S><AttendeesPage /></S> },
      { path: '/admin/events/:id/budget', element: <S><BudgetPage /></S> },
      {
        path: '/admin/venues',
        element: <AdminOnlyRoute><S><VenueManagementPage /></S></AdminOnlyRoute>,
      },
      { path: '/admin/venues/view', element: <S><ViewVenuesPage /></S> },
      {
        path: '/admin/users',
        element: <AdminOnlyRoute><S><UserManagementPage /></S></AdminOnlyRoute>,
      },
      {
        path: '/admin/vendor-applications',
        element: <AdminOnlyRoute><S><AdminReviewPage /></S></AdminOnlyRoute>,
      },
      { path: '/admin/reports/events', element: <S><EventReportsPage /></S> },
      { path: '/admin/reports/vendor-overview', element: <S><VendorOverviewPage /></S> },
      {
        path: '/admin/reports/admin-overview',
        element: <AdminOnlyRoute><S><AdminOverviewPage /></S></AdminOnlyRoute>,
      },
    ],
  },
]);

export default router;
