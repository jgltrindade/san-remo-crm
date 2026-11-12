-- =============================================================================
-- Testes: QR Code, presença e distribuição Round-Robin
-- Executar com:  ./scripts/test-db.sh   (ver README)
-- Cada bloco falha com ASSERT se a regra for violada (psql ON_ERROR_STOP).
-- =============================================================================
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

-- -----------------------------------------------------------------------------
-- Infraestrutura de teste
-- -----------------------------------------------------------------------------
create schema if not exists tests;
grant usage on schema tests to authenticated;

create table tests.vars (key text primary key, value text);
grant select, insert, update, delete on tests.vars to authenticated;

create or replace function tests.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
$$;
create or replace function tests.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', false);
$$;

-- Usuários: o trigger handle_new_user cria os perfis como 'broker'
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'gestora@example.com', '{"name":"Gestora"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'joao@example.com',    '{"name":"João"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'maria@example.com',   '{"name":"Maria"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'pedro@example.com',   '{"name":"Pedro"}'),
  ('00000000-0000-0000-0000-0000000000b4', 'ana@example.com',     '{"name":"Ana"}');

update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a1';

-- Reservatório: leads A..L, A é o mais antigo
insert into public.leads (name, phone, origin, interest, created_at)
select 'Lead ' || chr(64 + i), '4899999' || lpad(i::text, 4, '0'), 'site', 'Apartamento 2 quartos',
       now() - interval '1 day' + (i || ' minutes')::interval
  from generate_series(1, 12) as i;

\echo '[presença] corretor não pode gerar QR'
select tests.login('00000000-0000-0000-0000-0000000000b1');
set role authenticated;
do $$
begin
  perform public.get_presence_qr();
  raise exception 'esperava erro de permissão';
exception when insufficient_privilege then null;
end $$;
reset role;

\echo '[presença] gestor gera QR; segunda chamada devolve o MESMO token vigente'
select tests.login('00000000-0000-0000-0000-0000000000a1');
set role authenticated;
insert into tests.vars select 't1', public.get_presence_qr() ->> 'token';
do $$
declare v_again text := public.get_presence_qr() ->> 'token';
begin
  assert (select value from tests.vars where key = 't1') ~ '^[0-9a-f]{64}$', 'token deve ter 64 hex';
  assert v_again = (select value from tests.vars where key = 't1'), 'deve existir um único token vigente';
  assert public.check_in_presence((select value from tests.vars where key = 't1')) ->> 'status' = 'not_broker',
    'gestor não confirma presença';
end $$;
reset role;

do $$
begin
  assert (select count(*) from public.qr_tokens where expires_at > now()) = 1, 'um token vigente';
  assert not exists (select 1 from public.qr_tokens t, tests.vars v
                      where v.key = 't1' and t.token_hash = v.value), 'token não pode ser armazenado em texto puro';
  assert (select expires_at - created_at from public.qr_tokens order by created_at desc limit 1)
         = interval '5 minutes', 'validade do token = 5 minutos';
end $$;

\echo '[presença] João, Maria e Pedro entram na fila nesta ordem'
select tests.login('00000000-0000-0000-0000-0000000000b1'); set role authenticated;
do $$ declare r jsonb := public.check_in_presence((select value from tests.vars where key = 't1'));
begin
  assert r ->> 'status' = 'ok' and r ->> 'action' = 'joined', r::text;
  assert (r ->> 'valid_until')::timestamptz = now() + interval '5 hours', 'validade = 5 horas';
end $$;
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b2'); set role authenticated;
do $$ begin assert public.check_in_presence((select value from tests.vars where key = 't1')) ->> 'action' = 'joined'; end $$;
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b3'); set role authenticated;
do $$ begin assert public.check_in_presence((select value from tests.vars where key = 't1')) ->> 'action' = 'joined'; end $$;
reset role;

\echo '[presença] token inválido é rejeitado'
select tests.login('00000000-0000-0000-0000-0000000000b4'); set role authenticated;
do $$ begin
  assert public.check_in_presence(repeat('a', 64)) ->> 'status' = 'invalid_token';
  assert public.check_in_presence('drop table leads') ->> 'status' = 'invalid_token';
  assert public.check_in_presence(null) ->> 'status' = 'invalid_token';
end $$;
reset role;

\echo '[fila] corretor não pode distribuir'
select tests.login('00000000-0000-0000-0000-0000000000b1'); set role authenticated;
do $$ begin
  perform public.distribute_next_lead();
  raise exception 'esperava erro de permissão';
exception when insufficient_privilege then null;
end $$;
reset role;

\echo '[fila] exemplo do desafio: A->João, B->Maria, C->Pedro, D->João (volta ao início)'
select tests.login('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
do $$
declare
  r jsonb;
  expected text[][] := array[['Lead A','João'], ['Lead B','Maria'], ['Lead C','Pedro'], ['Lead D','João']];
begin
  for i in 1 .. 4 loop
    r := public.distribute_next_lead();
    assert r ->> 'status' = 'ok', r::text;
    assert r -> 'lead' ->> 'name' = expected[i][1] and r -> 'broker' ->> 'name' = expected[i][2],
      format('passo %s: esperado %s -> %s, obtido %s -> %s', i, expected[i][1], expected[i][2],
             r -> 'lead' ->> 'name', r -> 'broker' ->> 'name');
  end loop;
end $$;
reset role;

\echo '[fila] novo corretor (Ana) entra no FINAL: Maria, Pedro, Ana, João'
select tests.login('00000000-0000-0000-0000-0000000000b4'); set role authenticated;
do $$ begin assert public.check_in_presence((select value from tests.vars where key = 't1')) ->> 'action' = 'joined'; end $$;
reset role;

\echo '[fila] renovar presença válida (Maria) NÃO altera a posição'
do $$ begin
  insert into tests.vars select 'maria_pos', queue_position::text from public.broker_presence
   where broker_id = '00000000-0000-0000-0000-0000000000b2';
end $$;
select tests.login('00000000-0000-0000-0000-0000000000b2'); set role authenticated;
do $$ declare r jsonb := public.check_in_presence((select value from tests.vars where key = 't1'));
begin assert r ->> 'action' = 'renewed', r::text; end $$;
reset role;
do $$ begin
  assert (select queue_position::text from public.broker_presence where broker_id = '00000000-0000-0000-0000-0000000000b2')
         = (select value from tests.vars where key = 'maria_pos'), 'posição de Maria mudou ao renovar';
  assert (select count(*) from public.broker_presence) = 4, 'renovação não pode duplicar o corretor';
end $$;

select tests.login('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
do $$
declare
  r jsonb;
  expected text[][] := array[['Lead E','Maria'], ['Lead F','Pedro'], ['Lead G','Ana'], ['Lead H','João']];
begin
  for i in 1 .. 4 loop
    r := public.distribute_next_lead();
    assert r -> 'lead' ->> 'name' = expected[i][1] and r -> 'broker' ->> 'name' = expected[i][2],
      format('passo %s: esperado %s -> %s, obtido %s -> %s', i, expected[i][1], expected[i][2],
             r -> 'lead' ->> 'name', r -> 'broker' ->> 'name');
  end loop;
end $$;
reset role;

\echo '[fila] corretor expirado (Pedro) é ignorado'
update public.broker_presence set valid_until = now() - interval '1 second'
 where broker_id = '00000000-0000-0000-0000-0000000000b3';
select tests.login('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
do $$
declare r jsonb; o record;
begin
  r := public.distribute_next_lead();
  assert r -> 'broker' ->> 'name' = 'Maria', r::text;
  r := public.distribute_next_lead();
  assert r -> 'broker' ->> 'name' = 'Ana', 'Pedro (expirado) deveria ser pulado: ' || r::text;
  -- visão do gestor: Pedro aparece como expirado, sem posição
  select * into o from public.get_presence_overview() where name = 'Pedro';
  assert not o.is_valid and o.queue_rank is null, 'Pedro deve constar como expirado';
  select * into o from public.get_presence_overview() where is_next;
  assert o.name = 'João', 'próximo deve ser João, obtido ' || coalesce(o.name, 'ninguém');
end $$;
reset role;

\echo '[presença] QR expirado é rejeitado e substituído por um novo'
update public.qr_tokens set expires_at = now() - interval '1 second';
select tests.login('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
insert into tests.vars select 't2', public.get_presence_qr() ->> 'token';
reset role;
do $$ begin
  assert (select value from tests.vars where key = 't1') <> (select value from tests.vars where key = 't2'), 'token deve mudar';
  assert (select count(*) from public.qr_tokens where expires_at > now()) = 1, 'um único token vigente';
end $$;
select tests.login('00000000-0000-0000-0000-0000000000b3'); set role authenticated;
do $$ begin
  assert public.check_in_presence((select value from tests.vars where key = 't1')) ->> 'status' = 'expired_token',
    'token antigo deve ser rejeitado';
end $$;

\echo '[fila] Pedro retorna após expirar e entra no FINAL da fila'
do $$ declare r jsonb := public.check_in_presence((select value from tests.vars where key = 't2'));
begin assert r ->> 'status' = 'ok' and r ->> 'action' = 'rejoined', r::text; end $$;
reset role;
do $$ begin
  assert (select queue_position from public.broker_presence where broker_id = '00000000-0000-0000-0000-0000000000b3')
       > (select max(queue_position) from public.broker_presence where broker_id <> '00000000-0000-0000-0000-0000000000b3'),
       'Pedro deveria estar no final da fila';
  assert (select count(*) from public.broker_presence) = 4, 'sem duplicidade';
end $$;
-- Ordem agora: João, Maria, Ana, Pedro (Pedro com a maior posição).
-- O cursor está em Ana, então os próximos são Pedro e, voltando ao início, João.
select tests.login('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
do $$
declare r jsonb;
begin
  r := public.distribute_next_lead();
  assert r -> 'broker' ->> 'name' = 'Pedro', r::text;
  r := public.distribute_next_lead();
  assert r -> 'broker' ->> 'name' = 'João', r::text;
end $$;
reset role;

\echo '[corretor] get_my_presence informa posição e validade'
select tests.login('00000000-0000-0000-0000-0000000000b2'); set role authenticated;
do $$ declare r jsonb := public.get_my_presence();
begin
  assert (r ->> 'is_valid')::boolean and (r ->> 'queue_size')::int = 4, r::text;
  assert (r ->> 'service_order')::int = 1, 'Maria deveria ser a próxima: ' || r::text;
end $$;
reset role;

\echo '[fila] sem corretores válidos: não distribui e não altera nada'
insert into public.leads (name, phone, origin, interest) values ('Lead M', '48999990013', 'site', 'Casa');
update public.broker_presence set valid_until = now() - interval '1 second';
do $$ begin insert into tests.vars select 'unassigned', count(*)::text from public.leads where assigned_to is null; end $$;
select tests.login('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
do $$ begin assert public.distribute_next_lead() ->> 'status' = 'no_brokers'; end $$;
reset role;
do $$ begin
  assert (select count(*)::text from public.leads where assigned_to is null) = (select value from tests.vars where key = 'unassigned');
end $$;

\echo '[fila] sem leads no reservatório'
update public.broker_presence set valid_until = now() + interval '1 hour';
update public.leads set assigned_to = '00000000-0000-0000-0000-0000000000b1' where assigned_to is null;
select tests.login('00000000-0000-0000-0000-0000000000a1'); set role authenticated;
do $$ begin assert public.distribute_next_lead() ->> 'status' = 'no_leads'; end $$;
reset role;

\echo '[integridade] nenhum lead distribuído duas vezes; histórico consistente'
do $$ begin
  assert (select count(*) from public.distribution_history) = 12, 'esperadas 12 distribuições';
  assert (select count(distinct lead_id) from public.distribution_history) = 12, 'lead distribuído duas vezes';
  assert not exists (
    select 1 from public.distribution_history h join public.leads l on l.id = h.lead_id
     where l.assigned_to <> h.broker_id
  ), 'histórico diverge da atribuição';
  assert not exists (select 1 from public.distribution_history h join public.leads l on l.id = h.lead_id
                      where l.name = 'Lead M'), 'Lead M foi atribuído manualmente, sem histórico';
  assert (select count(*) from public.distribution_history where distributed_by is null) = 0, 'autor da distribuição';
end $$;

\echo 'OK: presença, QR Code e Round-Robin'
