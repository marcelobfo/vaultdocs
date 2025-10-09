
-- 1) Nova tabela de serviços por empresa
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

alter table public.services enable row level security;

-- Leitores/membros podem ver os serviços da empresa
create policy if not exists "members read services"
  on public.services
  for select
  using (public.is_company_member(company_id));

-- Admins da empresa e super_admin podem criar/editar/excluir
create policy if not exists "admins manage services"
  on public.services
  for all
  using (public.is_company_admin(company_id) or public.has_role(auth.uid(), 'super_admin'))
  with check (public.is_company_admin(company_id) or public.has_role(auth.uid(), 'super_admin'));

-- Atualização automática do updated_at
drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
before update on public.services
for each row
execute function public.set_updated_at();

-- 2) Ligar arquivos a um serviço
alter table public.files add column if not exists service_id uuid null;

alter table public.files
  add constraint if not exists files_service_id_fkey
  foreign key (service_id) references public.services(id) on delete set null;

create index if not exists files_service_id_idx on public.files(service_id);

-- 3) Garantir que o serviço pertença à mesma empresa do arquivo
create or replace function public.validate_file_service_company()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _service_company uuid;
begin
  if new.service_id is null then
    return new;
  end if;

  select s.company_id into _service_company
  from public.services s
  where s.id = new.service_id;

  if _service_company is null then
    raise exception 'Service % not found', new.service_id;
  end if;

  if _service_company <> new.company_id then
    raise exception 'Service belongs to a different company';
  end if;

  return new;
end;
$$;

drop trigger if exists files_validate_service_company on public.files;
create trigger files_validate_service_company
before insert or update of service_id, company_id
on public.files
for each row
execute function public.validate_file_service_company();

-- (Opcional e recomendado) manter updated_at de files em dia
drop trigger if exists files_set_updated_at on public.files;
create trigger files_set_updated_at
before update on public.files
for each row
execute function public.set_updated_at();
