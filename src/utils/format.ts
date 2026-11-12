import { format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Mantém apenas dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Formata telefone brasileiro: (48) 99999-9999 / (48) 3333-4444. */
export function formatPhone(value: string): string {
  const d = onlyDigits(value);
  const local = d.length > 11 ? d.slice(-11) : d;
  if (local.length <= 2) return local;
  if (local.length <= 6) return `(${local.slice(0, 2)}) ${local.slice(2)}`;
  if (local.length <= 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
}

/** Máscara progressiva para o input de telefone. */
export function maskPhoneInput(value: string): string {
  return formatPhone(onlyDigits(value).slice(0, 11));
}

export function formatDate(iso: string): string {
  return format(new Date(iso), 'dd/MM/yyyy', { locale: ptBR });
}

export function formatDateTime(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatTime(iso: string): string {
  return format(new Date(iso), 'HH:mm', { locale: ptBR });
}

/** "hoje, 14:32" | "ontem, 09:10" | "12/11, 08:00" */
export function formatShortDateTime(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return `hoje, ${format(date, 'HH:mm')}`;
  if (isYesterday(date)) return `ontem, ${format(date, 'HH:mm')}`;
  return format(date, "dd/MM, HH:mm", { locale: ptBR });
}

export function formatRelative(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { locale: ptBR, addSuffix: true });
}

/** mm:ss a partir de milissegundos. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
