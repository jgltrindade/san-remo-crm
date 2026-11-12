-- =============================================================================
-- San Remo CRM — SETUP COMPLETO DO BANCO (para colar no SQL Editor do Supabase)
-- Gerado a partir de supabase/migrations/*.sql, na ordem. Execute UMA vez,
-- num projeto novo. Depois crie os usuários e rode supabase/seed.sql.
-- =============================================================================


-- >>>>>>>>>>>>>>>>>>>> 20261112120000_core_schema.sql <<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- San Remo CRM — 001: esquema principal (perfis, leads, observações)
-- =============================================================================
-- Convenções:
--   * Todas as funções usam `set search_path = ''` e nomes totalmente
--     qualificados (proteção contra search_path hijacking).
--   * Regras de negócio críticas vivem no banco (triggers, RLS e RPCs).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Schema privado: não é exposto pela API REST do Supabase (PostgREST expõe
-- apenas `public` e `graphql_public`). Guarda segredos, sequência e cursor.
create schema if not exists private;
revoke all on schema private from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema private from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema private from authenticated';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('manager', 'broker');

create type public.lead_stage as enum (
  'new',         -- Novo
  'contacting',  -- Em contato
  'scheduled',   -- Visita agendada
  'proposal',    -- Proposta
  'won',         -- Ganho
  'lost'         -- Perdido
);

-- -----------------------------------------------------------------------------
-- profiles: dados complementares de auth.users
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  email       text not null,
  role        public.user_role not null default 'broker',
  created_at  timestamptz not null default now()
);

create unique index profiles_email_key on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role);

comment on table public.profiles is 'Perfil de cada usuário autenticado. O papel (role) só pode ser alterado por SQL administrativo.';

-- -----------------------------------------------------------------------------
-- leads
-- -----------------------------------------------------------------------------
create table public.leads (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 2 and 120),
  -- telefone armazenado somente com dígitos (DDD + número, opcionalmente DDI)
  phone        text not null check (phone ~ '^[0-9]{10,13}$'),
  email        text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  origin       text not null check (origin in (
                 'site', 'instagram', 'facebook', 'google_ads', 'portal',
                 'indicacao', 'whatsapp', 'plantao', 'outro')),
  interest     text not null check (char_length(btrim(interest)) between 2 and 500),
  stage        public.lead_stage not null default 'new',
  assigned_to  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Reservatório: leads sem responsável, do mais antigo para o mais novo.
-- Índice parcial usado diretamente pela distribuição.
create index leads_reservoir_idx on public.leads (created_at, id) where assigned_to is null;
create index leads_assigned_to_idx on public.leads (assigned_to);
create index leads_stage_idx on public.leads (stage);

comment on column public.leads.assigned_to is 'Corretor responsável. NULL = lead no reservatório do gestor.';

-- -----------------------------------------------------------------------------
-- lead_notes: observações (imutáveis) de um lead
-- -----------------------------------------------------------------------------
create table public.lead_notes (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  content     text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index lead_notes_lead_idx on public.lead_notes (lead_id, created_at desc);
create index lead_notes_user_idx on public.lead_notes (user_id);

-- -----------------------------------------------------------------------------
-- Funções auxiliares de papel (usadas pelas políticas RLS)
-- security definer: leem profiles sem disparar RLS (evita recursão).
-- -----------------------------------------------------------------------------
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'manager'
  );
$$;

create or replace function public.is_broker()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'broker'
  );
$$;

-- -----------------------------------------------------------------------------
-- Criação automática do perfil ao cadastrar usuário no Supabase Auth.
-- SEGURANÇA: o papel é SEMPRE 'broker'. Metadados enviados no cadastro são
-- controlados pelo cliente e nunca devem definir permissões. A promoção a
-- gestor é feita por SQL administrativo (ver README / seed.sql).
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    'broker'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Guarda de integridade dos leads (INSERT/UPDATE)
--   * O responsável, quando informado, precisa ser um corretor.
--   * created_at é imutável; updated_at é mantido pelo banco.
--   * Usuário autenticado que não é gestor (corretor) só pode alterar a ETAPA
--     dos próprios leads — nunca o responsável nem os dados cadastrais.
--     (A RLS garante que ele só enxerga/atualiza os próprios leads.)
--   * Execuções sem usuário (migrations, seed, service_role) não são afetadas.
-- -----------------------------------------------------------------------------
create or replace function public.leads_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and not exists (
       select 1 from public.profiles p
       where p.id = new.assigned_to and p.role = 'broker'
     ) then
    raise exception 'O responsável pelo lead precisa ser um corretor.'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.updated_at := new.created_at;
    return new;
  end if;

  new.created_at := old.created_at;
  new.updated_at := now();

  if v_uid is not null and not public.is_manager() then
    if new.assigned_to is distinct from old.assigned_to
       or new.name     is distinct from old.name
       or new.phone    is distinct from old.phone
       or new.email    is distinct from old.email
       or new.origin   is distinct from old.origin
       or new.interest is distinct from old.interest then
      raise exception 'Corretores só podem alterar a etapa dos próprios leads.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger leads_guard
  before insert or update on public.leads
  for each row execute function public.leads_guard();


-- >>>>>>>>>>>>>>>>>>>> 20261112120100_presence_qr.sql <<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- San Remo CRM — 002: presença por QR Code
-- =============================================================================
-- Modelo:
--   * qr_tokens guarda apenas o HASH (SHA-256) de cada token.
--   * O token em si é derivado por HMAC-SHA256(id, segredo). O segredo fica em
--     private.app_secrets, inacessível pela API. Assim, qualquer tela de gestor
--     aberta consegue exibir o MESMO token vigente sem armazená-lo em texto puro,
--     e o token é imprevisível sem o segredo (256 bits aleatórios).
--   * Existe no máximo um token vigente: a geração é serializada por advisory
--     lock e só cria um novo token quando o anterior expirou.
--   * broker_presence tem UMA linha por corretor (unique broker_id). A leitura
--     de um QR renova a validade (5 h) sem duplicar o corretor na fila.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Segredos do servidor
-- -----------------------------------------------------------------------------
create table private.app_secrets (
  key    text primary key,
  value  bytea not null
);

insert into private.app_secrets (key, value)
values ('qr_hmac_secret', extensions.gen_random_bytes(32))
on conflict (key) do nothing;

-- Sequência monotônica que define a ordem da fila circular.
-- Entrar (ou reentrar após expiração) = receber o próximo valor = final da fila.
create sequence private.broker_queue_seq as bigint;

-- -----------------------------------------------------------------------------
-- Tabelas públicas (acesso de escrita somente via RPC)
-- -----------------------------------------------------------------------------
create table public.qr_tokens (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index qr_tokens_created_idx on public.qr_tokens (created_at desc);
create index qr_tokens_expires_idx on public.qr_tokens (expires_at);

create table public.broker_presence (
  id               uuid primary key default gen_random_uuid(),
  broker_id        uuid not null unique references public.profiles (id) on delete cascade,
  valid_until      timestamptz not null,
  queue_position   bigint not null unique,
  last_checkin_at  timestamptz not null,
  created_at       timestamptz not null default now()
);

create index broker_presence_valid_idx on public.broker_presence (valid_until);

comment on column public.broker_presence.queue_position is
  'Posição na fila circular. Mantida ao renovar presença válida; recebe novo valor (final da fila) ao entrar ou reentrar após expiração.';

-- -----------------------------------------------------------------------------
-- Derivação do token (privada)
-- -----------------------------------------------------------------------------
create or replace function private.qr_token_for(p_token_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.hmac(convert_to(p_token_id::text, 'UTF8'), s.value, 'sha256'),
    'hex'
  )
  from private.app_secrets s
  where s.key = 'qr_hmac_secret';
$$;

create or replace function private.hash_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
$$;

-- -----------------------------------------------------------------------------
-- RPC (gestor): obtém o QR vigente, gerando um novo se o anterior expirou.
-- Retorna o token, a expiração e o horário do servidor (para o contador do
-- cliente compensar diferença de relógio).
-- -----------------------------------------------------------------------------
create or replace function public.get_presence_qr()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id          uuid;
  v_expires_at  timestamptz;
begin
  if not public.is_manager() then
    raise exception 'Apenas gestores podem gerar o QR Code de presença.'
      using errcode = '42501';
  end if;

  -- Serializa a geração: garante um único token vigente.
  perform pg_advisory_xact_lock(hashtext('san_remo.presence_qr'));

  select t.id, t.expires_at
    into v_id, v_expires_at
    from public.qr_tokens t
   where t.expires_at > now()
   order by t.created_at desc
   limit 1;

  if v_id is null then
    -- Defesa extra: encerra qualquer token que ainda esteja aberto.
    update public.qr_tokens set expires_at = now() where expires_at > now();

    v_id := gen_random_uuid();
    v_expires_at := now() + interval '5 minutes';

    insert into public.qr_tokens (id, token_hash, expires_at)
    values (v_id, private.hash_token(private.qr_token_for(v_id)), v_expires_at);
  end if;

  return jsonb_build_object(
    'token',       private.qr_token_for(v_id),
    'expires_at',  v_expires_at,
    'server_time', clock_timestamp()
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC (corretor): confirma presença a partir do token lido no QR Code.
-- Retorna jsonb com `status`:
--   ok             -> presença registrada; `action` = joined | renewed | rejoined
--   not_broker     -> usuário autenticado não é corretor
--   invalid_token  -> token inexistente/malformado
--   expired_token  -> token expirado ou substituído por um mais novo
-- -----------------------------------------------------------------------------
create or replace function public.check_in_presence(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_token        record;
  v_prev_valid   timestamptz;
  v_action       text;
  v_presence     record;
begin
  if v_uid is null then
    raise exception 'Sessão inválida. Faça login novamente.' using errcode = '28000';
  end if;

  if not public.is_broker() then
    return jsonb_build_object('status', 'not_broker');
  end if;

  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'invalid_token');
  end if;

  select t.id, t.expires_at, t.created_at
    into v_token
    from public.qr_tokens t
   where t.token_hash = private.hash_token(p_token);

  if not found then
    return jsonb_build_object('status', 'invalid_token');
  end if;

  -- Somente o token vigente: não expirado E não substituído por outro mais novo.
  if v_token.expires_at <= now()
     or exists (select 1 from public.qr_tokens t where t.created_at > v_token.created_at) then
    return jsonb_build_object('status', 'expired_token');
  end if;

  select bp.valid_until into v_prev_valid
    from public.broker_presence bp
   where bp.broker_id = v_uid;

  v_action := case
    when v_prev_valid is null then 'joined'
    when v_prev_valid > now() then 'renewed'
    else 'rejoined'
  end;

  -- Upsert atômico: uma linha por corretor.
  --   presença válida  -> mantém queue_position (renovação não muda a posição)
  --   expirada/nova    -> nova queue_position (final da fila)
  insert into public.broker_presence as bp (broker_id, valid_until, queue_position, last_checkin_at)
  values (v_uid, now() + interval '5 hours', nextval('private.broker_queue_seq'), now())
  on conflict (broker_id) do update
     set queue_position  = case when bp.valid_until > now() then bp.queue_position
                                else excluded.queue_position end,
         valid_until     = excluded.valid_until,
         last_checkin_at = excluded.last_checkin_at
  returning bp.valid_until, bp.last_checkin_at, bp.queue_position
    into v_presence;

  return jsonb_build_object(
    'status',          'ok',
    'action',          v_action,
    'valid_until',     v_presence.valid_until,
    'last_checkin_at', v_presence.last_checkin_at
  );
end;
$$;


-- >>>>>>>>>>>>>>>>>>>> 20261112120200_round_robin_distribution.sql <<<<<<<<<<<<<<<<<<<<

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


-- >>>>>>>>>>>>>>>>>>>> 20261112120300_rls_and_grants.sql <<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- San Remo CRM — 004: Row Level Security e privilégios
-- =============================================================================
-- Princípios:
--   * RLS habilitado em TODAS as tabelas públicas.
--   * Escrita em presença, tokens e histórico somente via RPC security definer.
--   * O frontend usa apenas a chave anon + JWT do usuário; nunca a service_role.
--   * `(select auth.uid())` é usado nas políticas para ser avaliado uma vez por
--     consulta (recomendação de performance do Supabase).
-- =============================================================================

alter table public.profiles             enable row level security;
alter table public.leads                enable row level security;
alter table public.lead_notes           enable row level security;
alter table public.broker_presence      enable row level security;
alter table public.qr_tokens            enable row level security;
alter table public.distribution_history enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
--   * Cada usuário vê o próprio perfil; gestores veem todos.
--   * Corretor vê também o nome de quem escreveu observações nos leads dele
--     (ex.: o gestor), para exibir o autor das observações.
--   * Ninguém altera perfis pela API (papéis só por SQL administrativo).
-- -----------------------------------------------------------------------------
create policy "profiles: leitura própria, gestor ou autor de observação"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_manager())
    or exists (
      select 1
        from public.lead_notes n
        join public.leads l on l.id = n.lead_id
       where n.user_id = profiles.id
         and l.assigned_to = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- leads
-- -----------------------------------------------------------------------------
create policy "leads: gestor vê todos, corretor vê os seus"
  on public.leads for select to authenticated
  using ((select public.is_manager()) or assigned_to = (select auth.uid()));

create policy "leads: somente gestor cadastra"
  on public.leads for insert to authenticated
  with check ((select public.is_manager()));

-- Corretor atualiza apenas os próprios leads e não pode transferi-los
-- (with check). O trigger leads_guard restringe a alteração à etapa.
create policy "leads: gestor edita todos, corretor edita os seus"
  on public.leads for update to authenticated
  using ((select public.is_manager()) or assigned_to = (select auth.uid()))
  with check ((select public.is_manager()) or assigned_to = (select auth.uid()));

-- Sem política de DELETE: exclusão de leads não faz parte do escopo.

-- -----------------------------------------------------------------------------
-- lead_notes (imutáveis: sem UPDATE/DELETE)
-- -----------------------------------------------------------------------------
create policy "lead_notes: leitura conforme acesso ao lead"
  on public.lead_notes for select to authenticated
  using (
    (select public.is_manager())
    or exists (
      select 1 from public.leads l
       where l.id = lead_notes.lead_id
         and l.assigned_to = (select auth.uid())
    )
  );

create policy "lead_notes: autor é o próprio usuário e tem acesso ao lead"
  on public.lead_notes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (select public.is_manager())
      or exists (
        select 1 from public.leads l
         where l.id = lead_notes.lead_id
           and l.assigned_to = (select auth.uid())
      )
    )
  );

-- -----------------------------------------------------------------------------
-- broker_presence (escrita apenas via check_in_presence)
-- -----------------------------------------------------------------------------
create policy "broker_presence: corretor vê a sua, gestor vê todas"
  on public.broker_presence for select to authenticated
  using (broker_id = (select auth.uid()) or (select public.is_manager()));

-- -----------------------------------------------------------------------------
-- qr_tokens: nenhuma política => nenhum acesso direto pela API.
-- Acesso apenas pelas RPCs get_presence_qr / check_in_presence.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- distribution_history (escrita apenas via distribute_next_lead)
-- -----------------------------------------------------------------------------
create policy "distribution_history: gestor vê tudo, corretor vê as suas"
  on public.distribution_history for select to authenticated
  using ((select public.is_manager()) or broker_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Privilégios (defesa em profundidade além do RLS)
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.leads, public.lead_notes, public.broker_presence,
              public.qr_tokens, public.distribution_history
  from anon;

revoke insert, update, delete, truncate on public.profiles             from authenticated;
revoke update, delete, truncate         on public.lead_notes           from authenticated;
revoke delete, truncate                 on public.leads                from authenticated;
revoke insert, update, delete, truncate on public.broker_presence      from authenticated;
revoke all                              on public.qr_tokens            from authenticated;
revoke insert, update, delete, truncate on public.distribution_history from authenticated;

grant select on public.profiles, public.leads, public.lead_notes, public.broker_presence,
                public.distribution_history
  to authenticated;
grant insert, update on public.leads to authenticated;
grant insert on public.lead_notes to authenticated;

-- Funções: o Postgres concede EXECUTE a PUBLIC por padrão e o Supabase concede
-- a anon/authenticated. Restringimos explicitamente.
revoke execute on function public.handle_new_user()      from public, anon, authenticated;
revoke execute on function public.leads_guard()          from public, anon, authenticated;
revoke execute on function public.is_manager()           from public, anon;
revoke execute on function public.is_broker()            from public, anon;
revoke execute on function public.get_presence_qr()      from public, anon;
revoke execute on function public.check_in_presence(text) from public, anon;
revoke execute on function public.distribute_next_lead() from public, anon;
revoke execute on function public.get_presence_overview() from public, anon;
revoke execute on function public.get_my_presence()      from public, anon;

grant execute on function public.is_manager()            to authenticated;
grant execute on function public.is_broker()             to authenticated;
grant execute on function public.get_presence_qr()       to authenticated;
grant execute on function public.check_in_presence(text) to authenticated;
grant execute on function public.distribute_next_lead()  to authenticated;
grant execute on function public.get_presence_overview() to authenticated;
grant execute on function public.get_my_presence()       to authenticated;

revoke all on all functions in schema private from public;
revoke all on all tables    in schema private from public;
revoke all on all sequences in schema private from public;
