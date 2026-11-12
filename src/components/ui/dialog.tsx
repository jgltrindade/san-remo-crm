import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

const overlay = 'fixed inset-0 z-40 bg-navy-900/40 backdrop-blur-[2px] animate-fade';

/** Modal centralizado (formulários e confirmações). */
export function Dialog({ open, onOpenChange, title, description, children, footer, className }: BaseProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlay} />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-card border border-line bg-surface shadow-lift animate-pop focus:outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold text-ink">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-muted">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="rounded-md p-1 text-subtle hover:bg-navy-50 hover:text-ink" aria-label="Fechar">
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Painel lateral (detalhes do lead, menu móvel). */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = 'right',
  className,
}: Omit<BaseProps, 'footer'> & { side?: 'left' | 'right' }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlay} />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 z-50 flex w-full flex-col bg-surface shadow-lift focus:outline-none',
            side === 'right' ? 'right-0 max-w-xl animate-slide-left border-l border-line' : 'left-0 max-w-[18rem] animate-slide-right',
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{description ?? title}</DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const SheetClose = DialogPrimitive.Close;
