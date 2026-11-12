import type { ReactNode } from 'react';
import { Button } from './button';
import { Dialog } from './dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  variant?: 'primary' | 'accent' | 'danger';
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  loading,
  variant = 'primary',
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
