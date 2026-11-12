import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { PresenceQrPanel } from '@/components/presence/PresenceQrPanel';

/** Tela para TV/monitor da recepção: somente o QR Code e o contador. */
export default function QrDisplayPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-navy-800 text-white">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <Link to="/gestor/presenca" className="flex items-center gap-2 text-sm text-navy-200 hover:text-white">
          <ArrowLeft className="size-4" aria-hidden />
          Voltar ao painel
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-12 text-center">
        <h1 className="font-display text-[2.5rem] leading-tight sm:text-[3.25rem]">Chegou? Confirme sua presença.</h1>
        <p className="mt-2 max-w-lg text-lg text-navy-200">Aponte a câmera do celular para o código e entre com sua conta de corretor.</p>
        <div className="mt-10 w-full max-w-md rounded-3xl bg-surface p-8 text-ink">
          <PresenceQrPanel size={300} variant="display" />
        </div>
      </main>
    </div>
  );
}
