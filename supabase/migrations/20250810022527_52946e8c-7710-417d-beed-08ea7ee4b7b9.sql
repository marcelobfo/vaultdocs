
-- 1) Tabela de serviços por empresa
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade
);

-- Índices para performance e unicidade de nome por empresa (case-insensitive)
create index if not exists idx_services_company on public.services (company_id);
create unique index if not exists uniq_services_company_name on public.services (company_id, lower(name));

-- Atualiza automaticamente o updated_at
drop trigger if exists trg_services_set_updated_at on public.services;
create trigger trg_services_set_updated_at
before update on public.services
for each row execute procedure public.set_updated_at();

-- 2) RLS
alter table public.services enable row level security;

-- Membros podem ler serviços da própria empresa
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'services' and policyname = 'members read company services'
  ) then
    create policy "members read company services"
      on public.services
      for select
      using (public.is_company_member(company_id));
  end if;
end$$;

-- Admins da empresa e super admins podem gerenciar (ALL)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'services' and policyname = 'admins manage company services'
  ) then
    create policy "admins manage company services"
      on public.services
      for all
      using (public.is_company_admin(company_id) or public.has_role(auth.uid(), 'super_admin'::app_role))
      with check (public.is_company_admin(company_id) or public.has_role(auth.uid(), 'super_admin'::app_role));
  end if;
end$$;

-- 3) Coluna service_id em files e FK
alter table public.files add column if not exists service_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'files_service_id_fkey'
  ) then
    alter table public.files
      add constraint files_service_id_fkey
      foreign key (service_id) references public.services(id)
      on delete set null;
  end if;
end$$;

-- 4) Trigger para garantir que o serviço pertence à mesma empresa do arquivo
create or replace function public.validate_file_service_company()
returns trigger
language plpgsql
as $$
begin
  if new.service_id is not null then
    if not exists (
      select 1 from public.services s
      where s.id = new.service_id and s.company_id = new.company_id
    ) then
      raise exception 'service_id % does not belong to company %', new.service_id, new.company_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_files_validate_service on public.files;
create trigger trg_files_validate_service
before insert or update of service_id, company_id on public.files
for each row execute procedure public.validate_file_service_company();
