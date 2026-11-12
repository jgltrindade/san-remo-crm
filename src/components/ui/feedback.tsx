import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-navy-50', className)} {...props} />;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-navy-50 text-navy-600">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-red-200 bg-danger-50 p-4 text-sm text-danger-600 sm:flex-row sm:items-center sm:justify-between">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-4">
          Tentar novamente
        </button>
      )}
    </div>
  );
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  dot?: string;
}

export function Badge({ className, dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', className)}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full" style={{ background: dot }} aria-hidden />}
      {children}
    </span>
  );
}
