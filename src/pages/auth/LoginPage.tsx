import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TriangleAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { loginSchema, type LoginValues } from '@/schemas/auth.schema';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { Logo } from '@/components/layout/Logo';
import { homePathFor } from '@/components/layout/navigation';

/** Aceita apenas caminhos internos para evitar open redirect. */
function safeRedirect(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith('/') && !value.startsWith('//') ? value : null;
}

export default function LoginPage() {
  const { signIn, status, profile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'));
  const fromQr = redirect?.startsWith('/presence/check-in') ?? false;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  useEffect(() => {
    if (status === 'signed-in' && profile) {
      navigate(redirect ?? homePathFor(profile.role), { replace: true });
    }
  }, [status, profile, redirect, navigate]);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Não foi possível entrar.');
    }
  });

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-navy-800 p-12 text-white lg:flex lg:flex-col">
        <Logo />
        <div className="my-auto max-w-md">
          <p className="font-display text-[3.25rem] leading-[1.05]">Cada lead no corretor certo, na vez certa.</p>
          <p className="mt-5 text-[15px] leading-relaxed text-navy-200">
            Os corretores confirmam presença pelo QR Code da recepção e entram na fila. A roleta distribui os leads um a um,
            sempre do mais antigo para o próximo da vez.
          </p>
        </div>
        {/* Anel decorativo: eco da fila circular da tela de distribuição */}
        <svg viewBox="0 0 400 400" className="pointer-events-none absolute -bottom-40 -right-40 size-[30rem] text-white/[0.06]" aria-hidden>
          <circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="200" cy="200" r="110" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 10" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return <circle key={i} cx={200 + Math.cos(a) * 150} cy={200 + Math.sin(a) * 150} r={i === 0 ? 14 : 9} fill="currentColor" />;
          })}
        </svg>
      </aside>

      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo tone="dark" />
          </div>

          <h1 className="font-display text-[2.25rem] leading-tight text-navy-800">Entrar</h1>
          <p className="mt-1 text-[15px] text-muted">
            {fromQr ? 'Entre com sua conta de corretor para confirmar sua presença.' : 'Use o e-mail e a senha da sua conta San Remo.'}
          </p>

          {!isSupabaseConfigured && (
            <div role="alert" className="mt-6 flex gap-2 rounded-lg border border-amber-200 bg-warn-50 p-3 text-sm text-amber-900">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Supabase não configurado. Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> no arquivo{' '}
                <code>.env.local</code>.
              </span>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
            <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
              />
            </Field>
            <Field label="Senha" htmlFor="password" error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
            </Field>

            {formError && (
              <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2.5 text-sm font-medium text-danger-600">
                {formError}
              </p>
            )}

            <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
              Entrar
            </Button>
          </form>

          <p className="mt-8 text-xs leading-relaxed text-subtle">
            Contas são criadas pelo gestor. Esqueceu a senha? Fale com a gestão da imobiliária.
          </p>
        </div>
      </main>
    </div>
  );
}
