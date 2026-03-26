import { useEffect, useRef } from 'react';
import { RouterProvider } from 'react-router-dom';
import router from './router';
import QueryProvider from './providers/QueryProvider';
import ToastProvider from './providers/ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';
import ClickSpark from '@/shared/ui/ClickSpark';
import { authApi } from '@/shared/api';
import useAuthStore from '@/shared/store/authStore';
import { parseAuthPayload } from '@/shared/utils/auth';

export default function App() {
  const { setAuth, setLoading, logout } = useAuthStore();
  const didRestoreRef = useRef(false);

  // Restore session on mount
  useEffect(() => {
    if (didRestoreRef.current) {
      return;
    }
    didRestoreRef.current = true;

    const restore = async () => {
      try {
        const { data } = await authApi.refresh();
        const auth = parseAuthPayload(data);
        if (!auth.user || !auth.accessToken) {
          throw new Error('Invalid refresh payload');
        }

        setAuth(auth.user, auth.accessToken);
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, [logout, setAuth, setLoading]);

  return (
    <ErrorBoundary>
      <QueryProvider>
        <ClickSpark
          sparkColor="#000000"
          sparkSize={7}
          sparkRadius={12}
          sparkCount={8}
          duration={300}
          easing="ease-out"
          extraScale={1}
        >
          <RouterProvider router={router} />
          <ToastProvider />
        </ClickSpark>
      </QueryProvider>
    </ErrorBoundary>
  );
}
