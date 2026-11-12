import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyPresence, getPresenceOverview, getPresenceQr } from '@/services/presence/presence.service';
import { queryKeys } from './queryKeys';

export function usePresenceOverview() {
  return useQuery({
    queryKey: queryKeys.presenceOverview,
    queryFn: getPresenceOverview,
    refetchInterval: 30_000,
  });
}

export function useMyPresence() {
  return useQuery({ queryKey: queryKeys.myPresence, queryFn: getMyPresence, refetchInterval: 60_000 });
}

/**
 * QR Code vigente com renovação automática.
 * O próximo pedido é agendado para o instante de expiração informado pelo
 * servidor, corrigido pela diferença entre o relógio do servidor e o local.
 */
export function usePresenceQr() {
  const query = useQuery({
    queryKey: queryKeys.presenceQr,
    queryFn: async () => {
      const qr = await getPresenceQr();
      const clockOffset = new Date(qr.serverTime).getTime() - Date.now();
      return { ...qr, clockOffset };
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 5_000;
      const remaining = new Date(data.expiresAt).getTime() - (Date.now() + data.clockOffset);
      return Math.max(remaining + 400, 1_000);
    },
    refetchIntervalInBackground: true,
    retry: 3,
  });

  return query;
}

/** Contador regressivo (ms restantes) atualizado a cada 250ms. */
export function useCountdown(expiresAt: string | undefined, clockOffset = 0) {
  const target = useMemo(() => (expiresAt ? new Date(expiresAt).getTime() : null), [expiresAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [target]);

  if (target === null) return null;
  return Math.max(0, target - (now + clockOffset));
}
