/** Link codificado no QR Code. Usa VITE_PUBLIC_APP_URL quando definida (ex.: domínio da Vercel). */
export function buildCheckInUrl(token: string): string {
  const base = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');
  return `${base}/presence/check-in?token=${encodeURIComponent(token)}`;
}
