import { Badge } from '@/components/ui/feedback';
import { STAGE_BY_VALUE } from '@/utils/constants';
import { cn } from '@/utils/cn';
import type { LeadStage } from '@/types/domain';

export function StageBadge({ stage, className }: { stage: LeadStage; className?: string }) {
  const meta = STAGE_BY_VALUE[stage];
  return (
    <Badge className={cn(meta.badge, className)} dot={meta.color}>
      {meta.label}
    </Badge>
  );
}
