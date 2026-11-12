import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

const fieldBase =
  'w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-subtle transition-colors focus:border-navy-400 focus:outline-none focus:ring-3 focus:ring-navy-100 disabled:cursor-not-allowed disabled:bg-canvas aria-[invalid=true]:border-danger-600 aria-[invalid=true]:ring-danger-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(fieldBase, 'min-h-24 py-2.5 leading-relaxed', className)} {...props} />,
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(fieldBase, 'h-10 appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
    </div>
  ),
);
Select.displayName = 'Select';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[13px] font-medium text-ink', className)} {...props} />;
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

/** Campo com rótulo, dica e mensagem de erro acessível. */
export function Field({ label, htmlFor, error, hint, optional, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1 font-normal text-subtle">(opcional)</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
