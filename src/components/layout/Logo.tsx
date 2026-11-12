import { cn } from '@/utils/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" className="text-white/10" />
      <path
        d="M8 16.5 16 9l8 7.5V24a1 1 0 0 1-1 1h-4.5v-5h-5v5H9a1 1 0 0 1-1-1z"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="23.5" cy="9" r="3" fill="#2FB173" />
    </svg>
  );
}

export function Logo({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className={tone === 'dark' ? 'rounded-lg bg-navy-800' : undefined} />
      <div className="leading-none">
        <span className={cn('block font-display text-[1.375rem]', tone === 'light' ? 'text-white' : 'text-navy-800')}>
          San Remo
        </span>
        <span className={cn('block text-[11px] font-medium', tone === 'light' ? 'text-navy-200' : 'text-muted')}>
          CRM de leads
        </span>
      </div>
    </div>
  );
}
