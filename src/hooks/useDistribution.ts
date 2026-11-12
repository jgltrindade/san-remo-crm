import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { distributeNextLead, listDistributionHistory } from '@/services/distribution/distribution.service';
import { queryKeys } from './queryKeys';

export function useDistributionHistory(ascending: boolean) {
  return useQuery({ queryKey: queryKeys.history(ascending), queryFn: () => listDistributionHistory(ascending) });
}

export function useDistributeNextLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: distributeNextLead,
    onSettled: () => {
      // Sucesso ou falha: recarrega o estado real do banco.
      void qc.invalidateQueries({ queryKey: queryKeys.leads });
      void qc.invalidateQueries({ queryKey: queryKeys.presenceOverview });
      void qc.invalidateQueries({ queryKey: ['distribution'] });
    },
  });
}
