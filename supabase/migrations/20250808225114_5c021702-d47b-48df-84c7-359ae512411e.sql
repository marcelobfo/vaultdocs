
-- 1) Enum para status de solicitação de conta
do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_request_status') then
    create type public.account_request_status as enum ('pending','approved','rejected');
  end if;
end $$;

-- 2) Tabela de solicitações de conta (fluxo de aprovação)
create table if not exists public.account_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  desired_company_id uuid references public.companies(id) on delete set null,
  message text,
  status public.account_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garantir 1 solicitação pendente por usuário
create unique index if not exists account_requests_one_pending_per_user
  on public.account_requests(user_id)
  where status = 'pending';

-- RLS
alter table public.account_requests enable row level security;

-- Políticas (refazendo para idempotência)
drop policy if exists "users create own requests" on public.account_requests;
drop policy if exists "users read own requests" on public.account_requests;
drop policy if exists "super admins read all requests" on public.account_requests;
drop policy if exists "super admins manage requests" on public.account_requests;

create policy "users create own requests"
  on public.account_requests
  for insert
  with check (user_id = auth.uid());

create policy "users read own requests"
  on public.account_requests
  for select
  using (user_id = auth.uid());

create policy "super admins read all requests"
  on public.account_requests
  for select
  using (public.has_role(auth.uid(), 'super_admin'::app_role));

create policy "super admins manage requests"
  on public.account_requests
  for update using (public.has_role(auth.uid(), 'super_admin'::app_role))
  with check (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger de atualização de updated_at
drop trigger if exists set_account_requests_updated_at on public.account_requests;
create trigger set_account_requests_updated_at
  before update on public.account_requests
  for each row execute procedure public.set_updated_at();

-- 3) Ativar trigger para criar profile automaticamente ao criar usuário no Auth
-- (a função public.handle_new_user() já existe no projeto)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4) Conceder papel SUPER ADMIN ao e-mail informado (executa só se o usuário já existir)
insert into public.user_roles (user_id, role)
select u.id, 'super_admin'::app_role
from auth.users u
where u.email = 'marcelo@technedigital.com.br'
on conflict (user_id, role) do nothing;

-- (Opcional) Função utilitária para conceder papéis por e-mail no futuro
create or replace function public.grant_role_by_email(_email text, _role public.app_role)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _uid uuid;
begin
  select id into _uid from auth.users where email = _email;
  if _uid is null then
    raise exception 'User with email % not found', _email;
  end if;

  insert into public.user_roles(user_id, role)
  values (_uid, _role)
  on conflict (user_id, role) do nothing;
end;
$$;
