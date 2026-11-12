import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleX, Clock, LoaderCircle, type LucideIcon } from 'lucide-react';
import { checkInPresence } from '@/services/presence/presence.service';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from '@/components/layout/Logo';
import { buttonVariants } from '@/components/ui/button';
import { formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { CheckInResult } from '@/types/domain';

type ViewState = { kind: 'loading' } | { kind: 'result'; result: CheckInResult } | { kind: 'error'; message: string };

interface Outcome {
  icon: LucideIcon;
  tone: 'success' | 'error' | 'warn';
  title: string;
  description: string;
}

function describe(state: ViewState): Outcome | null {
  if (state.kind === 'loading') return null;
  if (state.kind === 'error') {
    return { icon: CircleX, tone: 'error', title: 'Não foi possível confirmar', description: state.message };
  }
  const r = state.result;
  switch (r.status) {
    case 'ok': {
      const until = formatTime(r.validUntil);
      if (r.action === 'renewed') {
        return {
          icon: CircleCheck,
          tone: 'success',
          title: 'Presença renovada',
          description: `Sua posição na fila foi mantida. A presença agora vale até ${until}.`,
        };
      }
      return {
        icon: CircleCheck,
        tone: 'success',
        title: 'Presença confirmada',
        description: `Você entrou no final da fila de distribuição e pode receber leads até ${until}.`,
      };
    }
    case 'expired_token':
      return {
        icon: Clock,
        tone: 'warn',
        title: 'QR Code expirado',
        description: 'Este código já foi renovado. Leia o QR Code exibido agora na recepção.',
      };
    case 'not_broker':
      return {
        icon: CircleX,
        tone: 'error',
        title: 'Disponível apenas para corretores',
        description: 'A confirmação de presença é feita pela conta do corretor.',
      };
    case 'invalid_token':
      return {
        icon: CircleX,
        tone: 'error',
        title: 'QR Code inválido',
        description: 'O link não corresponde a um QR Code de presença. Leia novamente o código da recepção.',
      };
  }
}

const toneClass = {
  success: 'bg-mata-50 text-mata-600',
  error: 'bg-danger-50 text-danger-600',
  warn: 'bg-warn-50 text-warn-600',
} as const;

export default function CheckInPage() {
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const token = params.get('token');
  const [state, setState] = useState<ViewState>(() =>
    token ? { kind: 'loading' } : { kind: 'result', result: { status: 'invalid_token' } },
  );
  // Evita confirmar duas vezes (React StrictMode executa efeitos em dobro em dev).
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    checkInPresence(token)
      .then((result) => {
        setState({ kind: 'result', result });
        void qc.invalidateQueries({ queryKey: ['presence'] });
      })
      .catch((e: unknown) =>
        setState({ kind: 'error', message: e instanceof Error ? e.message : 'Erro inesperado.' }),
      )
      .finally(() => {
        // Remove o token da barra de endereço: recarregar a página não reenvia o código.
        window.history.replaceState(null, '', '/presence/check-in');
      });
  }, [token, qc]);

  const outcome = describe(state);
  const home = profile?.role === 'manager' ? '/gestor' : '/corretor/presenca';

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="bg-navy-800 px-5 py-4">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm rounded-card border border-line bg-surface p-8 text-center shadow-card" aria-live="polite">
          {!outcome ? (
            <div role="status" className="flex flex-col items-center gap-4 py-6">
              <LoaderCircle className="size-8 animate-spin text-navy-600" aria-hidden />
              <p className="text-sm text-muted">Validando o QR Code…</p>
            </div>
          ) : (
            <div className="animate-pop">
              <div className={cn('mx-auto grid size-16 place-items-center rounded-full', toneClass[outcome.tone])}>
                <outcome.icon className="size-8" aria-hidden />
              </div>
              <h1 className="mt-5 font-display text-[1.875rem] leading-tight text-navy-800">{outcome.title}</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{outcome.description}</p>
              {profile && <p className="mt-4 text-sm text-subtle">Conta: {profile.name}</p>}
              <Link to={home} className={buttonVariants({ variant: 'primary', className: 'mt-6 w-full' })}>
                {profile?.role === 'manager' ? 'Ir para o painel' : 'Ver minha presença'}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
