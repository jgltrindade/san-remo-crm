import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';
import { Sheet } from '@/components/ui/dialog';
import { Logo } from './Logo';
import { NAVIGATION, type NavItem } from './navigation';

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'bg-white/10 text-white' : 'text-navy-200 hover:bg-white/5 hover:text-white',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                aria-hidden
                className={cn(
                  'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-mata-500 transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
              />
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { profile } = useAuth();
  if (!profile) return null;
  return (
    <div className="flex h-full flex-col bg-navy-800 px-3 py-5">
      <div className="px-2 pb-6">
        <Logo />
      </div>
      <p className="px-3 pb-2 text-xs font-medium text-navy-400">
        {profile.role === 'manager' ? 'Gestão' : 'Área do corretor'}
      </p>
      <NavList items={NAVIGATION[profile.role]} onNavigate={onNavigate} />
      <div className="mt-auto rounded-lg border border-white/10 px-3 py-3 text-xs leading-relaxed text-navy-200">
        San Remo Imóveis
        <br />
        <span className="text-navy-400">Ambiente de demonstração</span>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const current = profile ? NAVIGATION[profile.role].find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to))) : undefined;

  if (!profile) return null;

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarBody />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} title="Menu" side="left">
        <SidebarBody onNavigate={() => setMobileOpen(false)} />
      </Sheet>

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="-ml-1 rounded-lg p-2 text-muted hover:bg-navy-50 lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </button>
        <span className="truncate text-sm font-medium text-muted">{current?.label}</span>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight text-ink">{profile.name}</p>
            <p className="text-xs text-muted">{profile.role === 'manager' ? 'Gestor(a)' : 'Corretor(a)'}</p>
          </div>
          <div
            className={cn(
              'grid size-9 place-items-center rounded-full text-[13px] font-semibold',
              profile.role === 'manager' ? 'bg-navy-800 text-white' : 'bg-mata-50 text-mata-700',
            )}
            aria-hidden
          >
            {initials(profile.name)}
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg p-2 text-muted hover:bg-navy-50 hover:text-ink"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
