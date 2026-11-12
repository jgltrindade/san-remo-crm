-- =============================================================================
-- San Remo CRM — 003: distribuição Round-Robin
-- =============================================================================
-- Fila contínua e circular (sem "sessões"):
--   * A ordem da fila é dada por broker_presence.queue_position (crescente).
--   * O cursor guarda a queue_position do último corretor que recebeu um lead.
--   * Próximo corretor = primeiro elegível com posição > cursor; se não houver,
--     volta ao início (menor posição elegível) — comportamento circular.
--   * Elegível = presença válida (valid_until > now()) e papel 'broker'.
--     Corretores expirados são simplesmente ignorados (não precisam ser apagados).
--
-- Exemplo do desafio: fila João(1), Maria(2), Pedro(3), cursor vazio:
--   A -> João (cursor=1) | B -> Maria (cursor=2) | C -> Pedro (cursor=3)
--   D -> nenhuma posição > 3 => volta ao início => João.
-- =============================================================================

create table public.distribution_history (
  id                              uuid primary key default gen_random_uuid(),
  lead_id                         uuid not null references public.leads (id) on delete cascade,
  broker_id                       uuid not null references public.profiles (id) on delete restrict,
  distributed_at                  timestamptz not null default now(),
  queue_position_at_distribution  bigint not null,
  distributed_by                  uuid references public.profiles (id) on delete set null
);

create index distribution_history_date_idx on public.distribution_history (distributed_at desc);
create index distribution_history_broker_idx on public.distribution_history (broker_id);
create index distribution_history_lead_idx on public.distribution_history (lead_id);

comment on column public.distribution_history.queue_position_at_distribution is
  'queue_position do corretor no momento da distribuição (valor gravado no cursor).';

-- Cursor da fila (linha única). Também é o "mutex" das distribuições:
-- toda distribuição trava esta linha com FOR UPDATE.
create table private.distribution_state (
  id                    boolean primary key default true check (id),
  last_queue_position   bigint,
  last_distributed_at   timestamptz,
  updated_at            timestamptz not null default now()
);

insert into private.distribution_state (id) values (true) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Fonte ÚNICA da ordem da fila. Usada pela distribuição e pelas telas.
--   queue_rank     : posição fixa na fila (1..n por queue_position)
--   service_order  : ordem de atendimento a partir do cursor (1 = próximo)
-- -----------------------------------------------------------------------------
create or replace function private.eligible_queue(p_cursor bigint)
returns table (
  broker_id        uuid,
  broker_name      text,
  queue_position   bigint,
  valid_until      timestamptz,
  last_checkin_at  timestamptz,
  queue_rank       integer,
  service_order    integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    bp.broker_id,
    p.name,
    bp.queue_position,
    bp.valid_until,
    bp.last_checkin_at,
    (row_number() over (order by bp.queue_position))::integer,
    (row_number() over (
       order by (bp.queue_position <= coalesce(p_cursor, 0)), bp.queue_position
    ))::integer
  from public.broker_presence bp
  join public.profiles p on p.id = bp.broker_id and p.role = 'broker'
  where bp.valid_until > now();
$$;

-- -----------------------------------------------------------------------------
-- RPC (gestor): distribui o lead mais antigo do reservatório ao próximo corretor.
-- Retorna jsonb com `status`: ok | no_leads | no_brokers.
--
-- Atomicidade e concorrência:
--   1. Trava o cursor (FOR UPDATE): distribuições simultâneas são serializadas
--      e cada uma enxerga o cursor já atualizado pela anterior.
--   2. Trava o lead mais antigo sem responsável (FOR UPDATE SKIP LOCKED):
--      um lead em edição concorrente é pulado em vez de bloquear a fila.
--   3. Trava e revalida a presença do corretor escolhido (FOR UPDATE), de modo
--      que um check-in concorrente não altera a fila no meio da operação.
--   4. Atribuição, histórico e cursor são gravados na MESMA transação.
-- -----------------------------------------------------------------------------
create or replace function public.distribute_next_lead()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cursor    bigint;
  v_lead      record;
  v_broker    record;
  v_history   record;
  v_attempt   integer := 0;
begin
  if not public.is_manager() then
    raise exception 'Apenas gestores podem distribuir leads.' using errcode = '42501';
  end if;

  -- 1. Trava o cursor (serializa distribuições)
  select ds.last_queue_position
    into v_cursor
    from private.distribution_state ds
   where ds.id
     for update;

  -- 2. Lead mais antigo ainda sem responsável
  select l.id, l.name, l.phone, l.origin, l.interest, l.created_at
    into v_lead
    from public.leads l
   where l.assigned_to is null
   order by l.created_at, l.id
   limit 1
     for update skip locked;

  if not found then
    return jsonb_build_object('status', 'no_leads');
  end if;

  -- 3. Próximo corretor elegível (circular), com trava e revalidação
  loop
    v_attempt := v_attempt + 1;

    select q.broker_id, q.broker_name, q.queue_position
      into v_broker
      from private.eligible_queue(v_cursor) q
     where q.service_order = 1;

    if not found then
      return jsonb_build_object('status', 'no_brokers');
    end if;

    perform 1
       from public.broker_presence bp
      where bp.broker_id = v_broker.broker_id
        and bp.queue_position = v_broker.queue_position
        and bp.valid_until > now()
        for update;

    exit when found;

    if v_attempt >= 5 then
      raise exception 'A fila de corretores mudou durante a distribuição. Tente novamente.'
        using errcode = '40001';
    end if;
  end loop;

  -- 4. Atribui, registra histórico e avança o cursor (mesma transação)
  update public.leads
     set assigned_to = v_broker.broker_id
   where id = v_lead.id
     and assigned_to is null;

  if not found then
    raise exception 'O lead já foi atribuído por outra operação. Tente novamente.'
      using errcode = '40001';
  end if;

  -- clock_timestamp(): horário real da distribuição (após obter as travas),
  -- e não o início da transação, para que o histórico reflita a ordem real.
  insert into public.distribution_history (lead_id, broker_id, queue_position_at_distribution, distributed_by, distributed_at)
  values (v_lead.id, v_broker.broker_id, v_broker.queue_position, auth.uid(), clock_timestamp())
  returning id, distributed_at into v_history;

  update private.distribution_state
     set last_queue_position = v_broker.queue_position,
         last_distributed_at = v_history.distributed_at,
         updated_at = now()
   where id;

  return jsonb_build_object(
    'status',         'ok',
    'history_id',     v_history.id,
    'distributed_at', v_history.distributed_at,
    'queue_position', v_broker.queue_position,
    'lead', jsonb_build_object(
      'id',         v_lead.id,
      'name',       v_lead.name,
      'phone',      v_lead.phone,
      'origin',     v_lead.origin,
      'interest',   v_lead.interest,
      'created_at', v_lead.created_at
    ),
    'broker', jsonb_build_object(
      'id',   v_broker.broker_id,
      'name', v_broker.broker_name
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC (gestor): visão de presença + fila de todos os corretores.
-- -----------------------------------------------------------------------------
create or replace function public.get_presence_overview()
returns table (
  broker_id        uuid,
  name             text,
  email            text,
  is_valid         boolean,
  valid_until      timestamptz,
  last_checkin_at  timestamptz,
  queue_position   bigint,
  queue_rank       integer,
  service_order    integer,
  is_next          boolean,
  assigned_leads   integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_cursor bigint;
begin
  if not public.is_manager() then
    raise exception 'Apenas gestores podem consultar a fila.' using errcode = '42501';
  end if;

  select ds.last_queue_position into v_cursor from private.distribution_state ds where ds.id;

  return query
  select
    p.id,
    p.name,
    p.email,
    (q.broker_id is not null),
    bp.valid_until,
    bp.last_checkin_at,
    q.queue_position,
    q.queue_rank,
    q.service_order,
    coalesce(q.service_order = 1, false),
    (select count(*)::integer from public.leads l where l.assigned_to = p.id)
  from public.profiles p
  left join public.broker_presence bp on bp.broker_id = p.id
  left join private.eligible_queue(v_cursor) q on q.broker_id = p.id
  where p.role = 'broker'
  order by (q.broker_id is null), q.queue_rank, bp.last_checkin_at desc nulls last, p.name;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC (corretor): status da própria presença e posição na fila.
-- -----------------------------------------------------------------------------
create or replace function public.get_my_presence()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_cursor    bigint;
  v_presence  record;
  v_queue     record;
  v_size      integer;
begin
  if not public.is_broker() then
    raise exception 'Apenas corretores possuem presença.' using errcode = '42501';
  end if;

  select ds.last_queue_position into v_cursor from private.distribution_state ds where ds.id;

  select bp.valid_until, bp.last_checkin_at
    into v_presence
    from public.broker_presence bp
   where bp.broker_id = v_uid;

  select q.queue_rank, q.service_order
    into v_queue
    from private.eligible_queue(v_cursor) q
   where q.broker_id = v_uid;

  select count(*)::integer into v_size from private.eligible_queue(v_cursor);

  return jsonb_build_object(
    'is_valid',        v_queue.queue_rank is not null,
    'valid_until',     v_presence.valid_until,
    'last_checkin_at', v_presence.last_checkin_at,
    'queue_rank',      v_queue.queue_rank,
    'service_order',   v_queue.service_order,
    'queue_size',      v_size
  );
end;
$$;
