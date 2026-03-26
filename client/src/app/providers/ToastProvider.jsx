import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#FAFAF5',
          color: '#1A1A2E',
          border: '3px solid #1A1A2E',
          boxShadow: '4px 4px 0px #1A1A2E',
          borderRadius: '0px',
          fontFamily: '"Anonymous Pro", monospace',
          fontWeight: 700,
          padding: '14px 20px',
        },
        success: {
          iconTheme: {
            primary: '#06D6A0',
            secondary: '#FAFAF5',
          },
        },
        error: {
          iconTheme: {
            primary: '#EF4444',
            secondary: '#FAFAF5',
          },
        },
      }}
    />
  );
}
