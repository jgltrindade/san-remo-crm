import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { homePathFor } from '@/components/layout/navigation';
import type { UserRole } from '@/types/domain';

export function FullPageLoader({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas" role="status">
      <div className="flex items-center gap-3 text-sm text-muted">
        <LoaderCircle className="size-5 animate-spin text-navy-600" aria-hidden />
        {label}
      </div>
    </div>
  );
}

function MissingProfile() {
  const { signOut } = useAuth();
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl text-navy-800">Perfil não encontrado</h1>
        <p className="mt-2 text-sm text-muted">
          Sua conta existe, mas ainda não possui um perfil de acesso ao CRM. Peça ao gestor para concluir o cadastro.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => void signOut()}>
          Sair
        </Button>
      </div>
    </div>
  );
}

/**
 * Proteção de rotas na interface. É uma camada de UX: a segurança real está
 * no banco (RLS + verificação de papel nas RPCs).
 */
export function RequireAuth({ children, role }: { children: ReactNode; role?: UserRole }) {
  const { status, profile } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader />;
  if (status === 'signed-out') {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (status === 'no-profile' || !profile) return <MissingProfile />;
  if (role && profile.role !== role) return <Navigate to={homePathFor(profile.role)} replace />;

  return <>{children}</>;
}

export function HomeRedirect() {
  const { status, profile } = useAuth();
  if (status === 'loading') return <FullPageLoader />;
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={homePathFor(profile.role)} replace />;
}
