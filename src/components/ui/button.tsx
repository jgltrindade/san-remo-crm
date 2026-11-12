import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

// eslint-disable-next-line react-refresh/only-export-components
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-navy-800 text-white hover:bg-navy-700 active:bg-navy-900',
        accent: 'bg-mata-600 text-white hover:bg-mata-700',
        outline: 'border border-line-strong bg-surface text-ink hover:bg-navy-50',
        ghost: 'text-muted hover:bg-navy-50 hover:text-ink',
        danger: 'bg-danger-600 text-white hover:brightness-95',
        link: 'h-auto px-0 text-navy-600 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
