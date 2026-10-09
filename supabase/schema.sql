-- Gestão de Escalas: estrutura do banco no Supabase.
-- Rode este arquivo inteiro no SQL Editor do Supabase (antes do seed.sql).
-- Pode rodar mais de uma vez sem estragar nada.

-- 1) Tabela principal: cada linha é um registro do app (colaborador, extra, falta, baixa de feriado etc.)
create table if not exists public.docs (
  collection text        not null,
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

-- 2) Lista de e-mails que podem usar o app
create table if not exists public.allowed_users (
  email text primary key
);

-- 3) Segurança: ninguém lê nem grava sem passar pelas regras abaixo
alter table public.docs          enable row level security;
alter table public.allowed_users enable row level security;
revoke all on public.docs, public.allowed_users from anon;
revoke all on public.allowed_users from authenticated;

create or replace function public.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_allowed() from public, anon;
grant execute on function public.is_allowed() to authenticated;

drop policy if exists docs_somente_liberados on public.docs;
create policy docs_somente_liberados on public.docs
  for all to authenticated
  using (public.is_allowed())
  with check (public.is_allowed());

-- 4) Atualização em tempo real entre aparelhos
alter table public.docs replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs'
  ) then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;

-- 5) QUEM PODE ENTRAR: troque pelo e-mail que você vai cadastrar em Authentication > Users.
--    Para liberar mais pessoas, repita uma linha por e-mail.
insert into public.allowed_users (email) values
  ('troque-pelo-seu-email@exemplo.com')
on conflict do nothing;
