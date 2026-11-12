import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LeadMetrics } from '@/utils/leads';

const axisTick = { fill: '#5b6577', fontSize: 12 };

interface TooltipPayload {
  value?: number;
  payload?: { label?: string };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{item?.payload?.label}</p>
      <p className="text-muted tabular">
        {item?.value} {item?.value === 1 ? 'lead' : 'leads'}
      </p>
    </div>
  );
}

/** Funil por etapa: barras horizontais com a cor de cada etapa. */
export function StageFunnelChart({ data }: { data: LeadMetrics['byStage'] }) {
  return (
    <div className="h-64" role="img" aria-label={`Leads por etapa: ${data.map((d) => `${d.label} ${d.count}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke="#e2e7ee" />
          <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={112} tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#eef2f8' }} content={<ChartTooltip />} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.stage} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OriginChart({ data }: { data: LeadMetrics['byOrigin'] }) {
  return (
    <div className="h-64" role="img" aria-label={`Leads por origem: ${data.map((d) => `${d.label} ${d.count}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#e2e7ee" />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => v.split(' ')[0] ?? v} />
          <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#eef2f8' }} content={<ChartTooltip />} />
          <Bar dataKey="count" fill="#26406b" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
