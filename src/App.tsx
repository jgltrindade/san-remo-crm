import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppRoutes } from '@/routes/AppRoutes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="top-right" richColors closeButton toastOptions={{ style: { fontFamily: 'var(--font-sans)' } }} />
    </QueryClientProvider>
  );
}
