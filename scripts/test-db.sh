#!/usr/bin/env bash
# =============================================================================
# Testes do banco em um PostgreSQL 15+ puro (sem Supabase).
#
# Para cada suíte: cria um banco descartável, aplica o shim do Supabase Auth,
# todas as migrations e executa os testes. Ao final roda um teste de
# concorrência com chamadas simultâneas à distribuição.
#
# Uso:  PGUSER=postgres ./scripts/test-db.sh
# Requer um usuário com permissão para criar bancos (as variáveis PG* padrão
# do libpq são respeitadas: PGHOST, PGPORT, PGUSER, PGPASSWORD).
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
TESTS="$ROOT/supabase/tests"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

fresh_db() {
  local db="$1"
  "${PSQL[@]}" -d postgres -c "drop database if exists $db" -c "create database $db" >/dev/null
  "${PSQL[@]}" -d "$db" -f "$TESTS/00_supabase_auth_shim.sql" >/dev/null
  for m in "$MIGRATIONS"/*.sql; do
    "${PSQL[@]}" -d "$db" -f "$m" >/dev/null
  done
}

for suite in "$TESTS"/[1-9]*_test.sql; do
  db="sanremo_test_$(basename "$suite" .sql | tr -c 'a-z0-9_\n' '_')"
  echo "==> $(basename "$suite")"
  fresh_db "$db"
  "${PSQL[@]}" -d "$db" -f "$suite"
  "${PSQL[@]}" -d postgres -c "drop database $db" >/dev/null
done

# -----------------------------------------------------------------------------
# Seed: não falha sem usuários; com usuários, é aplicado e idempotente.
# -----------------------------------------------------------------------------
echo "==> seed.sql"
db="sanremo_test_seed"
fresh_db "$db"
"${PSQL[@]}" -d "$db" -f "$ROOT/supabase/seed.sql" 2>&1 | grep -q "Seed ignorado" && echo "    sem usuários: ignorado com aviso"
"${PSQL[@]}" -d "$db" <<'SQL' >/dev/null
insert into auth.users (email, raw_user_meta_data) values
  ('gestor@example.com', '{}'), ('ana.lima@example.com', '{}'), ('bruno.costa@example.com', '{}'),
  ('carla.souza@example.com', '{}'), ('diego.rocha@example.com', '{}');
SQL
"${PSQL[@]}" -d "$db" -f "$ROOT/supabase/seed.sql" >/dev/null
"${PSQL[@]}" -d "$db" -f "$ROOT/supabase/seed.sql" >/dev/null
"${PSQL[@]}" -d "$db" <<'SQL'
do $$ begin
  assert (select count(*) from public.leads) = 15, 'esperados 15 leads';
  assert (select count(*) from public.leads where assigned_to is null) = 6, 'esperados 6 no reservatório';
  assert (select count(*) from public.lead_notes) = 5, 'esperadas 5 observações';
  assert (select role from public.profiles where email = 'gestor@example.com') = 'manager';
  assert (select count(*) from public.profiles where role = 'broker') = 4;
  assert (select count(distinct origin) from public.leads) >= 6, 'origens variadas';
  assert (select count(distinct stage) from public.leads) = 6, 'todas as etapas representadas';
end $$;
SQL
"${PSQL[@]}" -d postgres -c "drop database $db" >/dev/null
echo "OK: seed"

# -----------------------------------------------------------------------------
# Concorrência: 30 leads, 3 corretores, 45 chamadas simultâneas.
# Esperado: 30 distribuições, nenhum lead repetido, 10 leads por corretor
# (as distribuições são serializadas pelo cursor, então a alternância é exata),
# e 15 chamadas recebendo "no_leads".
# -----------------------------------------------------------------------------
echo "==> concorrência (45 chamadas simultâneas)"
db="sanremo_test_concurrency"
fresh_db "$db"
"${PSQL[@]}" -d "$db" <<'SQL'
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'gestora@example.com', '{"name":"Gestora"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'joao@example.com',    '{"name":"João"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'maria@example.com',   '{"name":"Maria"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'pedro@example.com',   '{"name":"Pedro"}');
update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.broker_presence (broker_id, valid_until, queue_position, last_checkin_at)
select id, now() + interval '5 hours', nextval('private.broker_queue_seq'), now()
  from public.profiles where role = 'broker' order by name;
insert into public.leads (name, phone, origin, interest, created_at)
select 'Lead ' || i, '4899999' || lpad(i::text, 4, '0'), 'site', 'Apartamento',
       now() - interval '1 hour' + (i || ' seconds')::interval
  from generate_series(1, 30) i;
SQL

CALL="set role authenticated;
select set_config('request.jwt.claims', '{\"sub\":\"00000000-0000-0000-0000-0000000000a1\"}', false);
select public.distribute_next_lead() ->> 'status';"

tmp="$(mktemp -d)"
for i in $(seq 1 45); do
  psql -X -q -t -A -d "$db" -c "$CALL" >"$tmp/$i.out" 2>"$tmp/$i.err" &
done
wait

ok=$(cat "$tmp"/*.out | grep -c '^ok$' || true)
none=$(cat "$tmp"/*.out | grep -c '^no_leads$' || true)
errors=$(cat "$tmp"/*.err | grep -cv '^$' || true)
echo "    ok=$ok no_leads=$none erros=$errors"
rm -rf "$tmp"

"${PSQL[@]}" -d "$db" <<SQL
do \$\$ begin
  assert $ok = 30 and $none = 15 and $errors = 0, 'resultado inesperado das chamadas';
  assert (select count(*) from public.distribution_history) = 30, 'histórico deveria ter 30 linhas';
  assert (select count(distinct lead_id) from public.distribution_history) = 30, 'lead distribuído duas vezes';
  assert not exists (select 1 from public.leads where assigned_to is null), 'sobrou lead no reservatório';
  assert (select array_agg(c order by c) from (
            select count(*) c from public.distribution_history group by broker_id) x) = array[10,10,10]::bigint[],
         'distribuição deveria ser 10/10/10';
  -- a ordem de distribuição segue a ordem de cadastro dos leads
  assert not exists (
    select 1 from (
      select l.created_at, lag(l.created_at) over (order by h.distributed_at, h.id) prev
        from public.distribution_history h join public.leads l on l.id = h.lead_id
    ) s where s.prev > s.created_at
  ), 'leads fora da ordem de cadastro';
end \$\$;
SQL
"${PSQL[@]}" -d postgres -c "drop database $db" >/dev/null
echo "OK: concorrência"
echo
echo "Todos os testes do banco passaram."
