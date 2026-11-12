import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="text-center">
        <p className="font-display text-7xl text-navy-200">404</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">Página não encontrada</h1>
        <p className="mt-1 text-sm text-muted">O endereço pode ter mudado ou não existe.</p>
        <Link to="/" className={buttonVariants({ variant: 'primary', className: 'mt-6' })}>
          Ir para o início
        </Link>
      </div>
    </div>
  );
}
