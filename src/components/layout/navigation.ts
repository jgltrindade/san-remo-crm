import {
  History,
  Inbox,
  LayoutDashboard,
  QrCode,
  Shuffle,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types/domain';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const NAVIGATION: Record<UserRole, NavItem[]> = {
  manager: [
    { to: '/gestor', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/gestor/leads', label: 'Leads', icon: Users },
    { to: '/gestor/reservatorio', label: 'Reservatório de leads', icon: Inbox },
    { to: '/gestor/distribuicao', label: 'Distribuição de leads', icon: Shuffle },
    { to: '/gestor/corretores', label: 'Corretores', icon: UserRoundCheck },
    { to: '/gestor/presenca', label: 'Presença dos corretores', icon: QrCode },
    { to: '/gestor/historico', label: 'Histórico de distribuições', icon: History },
  ],
  broker: [
    { to: '/corretor', label: 'Meu dashboard', icon: LayoutDashboard, end: true },
    { to: '/corretor/leads', label: 'Meus leads', icon: Users },
    { to: '/corretor/presenca', label: 'Minha presença', icon: QrCode },
  ],
};

export function homePathFor(role: UserRole): string {
  return role === 'manager' ? '/gestor' : '/corretor';
}
