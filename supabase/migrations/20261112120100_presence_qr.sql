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
