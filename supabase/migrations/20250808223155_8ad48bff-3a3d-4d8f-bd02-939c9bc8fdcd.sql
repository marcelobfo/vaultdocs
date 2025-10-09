
-- Enums
create type public.app_role as enum ('super_admin','company_admin','viewer');
create type public.inspection_type as enum ('tanques','vasos_pressao','tubulacoes','end','outros');
create type public.permission_scope as enum ('company','custom');
create type public.webhook_event as enum ('file_uploaded','file_deleted');

-- Perfis de usuário (espelho de auth.users)
create table public.profiles (
  id uuid primary key,
  email text unique,
  first_name text,
  last_name text,
  full_name text generated always as (
    coalesce(first_name,'') ||
    case when first_name is not null and last_name is not null then ' ' else '' end ||
    coalesce(last_name,'')
  ) stored,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Função para criar perfil quando novo usuário é criado
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Função utilitária updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Roles globais (ex.: super_admin)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- Função para checar role global
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- Empresas
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  branch text,            -- filial
  logo_url text,
  cnpj text,
  city text,
  state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.companies enable row level security;

create trigger companies_set_updated_at
before update on public.companies
for each row execute procedure public.set_updated_at();

-- Associação usuário x empresa (papel por empresa)
create table public.user_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role public.app_role not null default 'viewer',
  unique (user_id, company_id)
);
alter table public.user_companies enable row level security;

-- Pastas (com pasta raiz por empresa)
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete set null,
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.folders enable row level security;

create trigger folders_set_updated_at
before update on public.folders
for each row execute procedure public.set_updated_at();

-- Arquivos (metadados; conteúdo no Storage)
create table public.files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  name text not null,                   -- nome original
  bucket_id text not null default 'documents',
  storage_path text not null unique,    -- company_id/folder_id/filename.ext
  size bigint,
  mime_type text,
  os_order text,                        -- Ordem de Serviço
  inspection public.inspection_type,
  expires_at timestamptz not null,
  permission_scope public.permission_scope not null default 'company',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.files enable row level security;

create trigger files_set_updated_at
before update on public.files
for each row execute procedure public.set_updated_at();

-- Permissões personalizadas por arquivo (quando permission_scope = 'custom')
create table public.file_permissions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unique (file_id, user_id)
);
alter table public.file_permissions enable row level security;

-- Webhooks por empresa
create table public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  url text not null,
  secret text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.webhook_subscriptions enable row level security;

-- Logs de webhooks
create table public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event public.webhook_event not null,
  url text not null,
  request_body jsonb,
  response_status int,
  response_body text,
  created_at timestamptz not null default now()
);
alter table public.webhook_logs enable row level security;
create index webhook_logs_company_idx on public.webhook_logs(company_id, created_at desc);

-- Push (armazenamento de tokens por usuário)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text, -- 'web' | 'ios' | 'android'
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

-- Funções auxiliares de RLS por empresa
create or replace function public.is_company_member(_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(),'super_admin')
         or exists (select 1 from public.user_companies uc
                    where uc.company_id = _company_id and uc.user_id = auth.uid());
$$;

create or replace function public.is_company_admin(_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(),'super_admin')
         or exists (select 1 from public.user_companies uc
                    where uc.company_id = _company_id
                      and uc.user_id = auth.uid()
                      and uc.role = 'company_admin');
$$;

-- Regras de acesso a arquivos (metadados)
create or replace function public.can_read_file(_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(auth.uid(),'super_admin')
    or (
      exists (select 1 from public.files f
              where f.id = _file_id
                and public.is_company_member(f.company_id)
                and (
                  f.permission_scope = 'company'
                  or exists (select 1 from public.file_permissions fp
                             where fp.file_id = f.id
                               and fp.user_id = auth.uid())
                )
            )
    );
$$;

-- Políticas RLS

-- profiles
create policy "read own profile" on public.profiles
for select to authenticated
using (id = auth.uid());
create policy "update own profile" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());
create policy "super admins can read all profiles" on public.profiles
for select to authenticated
using (public.has_role(auth.uid(),'super_admin'));

-- user_roles
create policy "read own roles" on public.user_roles
for select to authenticated
using (user_id = auth.uid());
create policy "super admins manage roles" on public.user_roles
for all to authenticated
using (public.has_role(auth.uid(),'super_admin'))
with check (public.has_role(auth.uid(),'super_admin'));

-- companies
create policy "members read company" on public.companies
for select to authenticated
using (public.is_company_member(id));
create policy "super admins manage companies" on public.companies
for all to authenticated
using (public.has_role(auth.uid(),'super_admin'))
with check (public.has_role(auth.uid(),'super_admin'));

-- user_companies
create policy "user reads own memberships" on public.user_companies
for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(),'super_admin'));
create policy "super admins manage memberships" on public.user_companies
for all to authenticated
using (public.has_role(auth.uid(),'super_admin'))
with check (public.has_role(auth.uid(),'super_admin'));

-- folders
create policy "members read folders" on public.folders
for select to authenticated
using (public.is_company_member(company_id));
create policy "admins manage folders" on public.folders
for all to authenticated
using (public.is_company_admin(company_id) or public.has_role(auth.uid(),'super_admin'))
with check (public.is_company_admin(company_id) or public.has_role(auth.uid(),'super_admin'));

-- files
create policy "members read allowed files" on public.files
for select to authenticated
using (public.can_read_file(id));
create policy "admins insert files" on public.files
for insert to authenticated
with check (public.is_company_admin(company_id) and created_by = auth.uid());
create policy "admins update/delete files" on public.files
for update to authenticated
using (public.is_company_admin(company_id) or public.has_role(auth.uid(),'super_admin'))
with check (public.is_company_admin(company_id) or public.has_role(auth.uid(),'super_admin'));
create policy "admins delete files" on public.files
for delete to authenticated
using (public.is_company_admin(company_id) or public.has_role(auth.uid(),'super_admin'));

-- file_permissions (somente admin altera; leitura não necessária no app)
create policy "admins manage file permissions" on public.file_permissions
for all to authenticated
using (exists (select 1 from public.files f
              where f.id = file_id
                and (public.is_company_admin(f.company_id) or public.has_role(auth.uid(),'super_admin'))))
with check (exists (select 1 from public.files f
                   where f.id = file_id
                     and (public.is_company_admin(f.company_id) or public.has_role(auth.uid(),'super_admin'))));

-- webhooks
create policy "admins manage webhooks" on public.webhook_subscriptions
for all to authenticated
using (public.is_company_admin(company_id) or public.has_role(auth.uid(),'super_admin'))
with check (public.is_company_admin(company_id) or public.has_role(auth.uid(),'super_admin'));

create policy "admins read webhook logs" on public.webhook_logs
for select to authenticated
using (public.is_company_admin(company_id) or public.has_role(auth.uid(),'super_admin'));
create policy "admins insert webhook logs" on public.webhook_logs
for insert to authenticated
with check (public.is_company_admin(company_id) or public.has_role(auth.uid(),'super_admin'));

-- push_subscriptions
create policy "users manage own push tokens" on public.push_subscriptions
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy "super admins read all push tokens" on public.push_subscriptions
for select to authenticated
using (public.has_role(auth.uid(),'super_admin'));

-- Pasta raiz automática por empresa
create or replace function public.create_root_folder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.folders (company_id, name)
  values (new.id, 'Root');
  return new;
end;
$$;

drop trigger if exists companies_create_root_folder on public.companies;
create trigger companies_create_root_folder
after insert on public.companies
for each row execute procedure public.create_root_folder();

-- Validação de expiração (usar trigger, não CHECK)
create or replace function public.validate_file_expiration()
returns trigger
language plpgsql
as $$
begin
  if new.expires_at <= now() then
    raise exception 'expires_at must be in the future';
  end if;
  return new;
end;
$$;

drop trigger if exists files_validate_expiration on public.files;
create trigger files_validate_expiration
before insert or update on public.files
for each row execute procedure public.validate_file_expiration();

-- Storage: bucket privado para documentos
insert into storage.buckets (id, name, public)
values ('documents','documents', false)
on conflict (id) do nothing;

-- Funções para políticas do Storage
create or replace function public.object_company_id(object_name text)
returns uuid
language sql
stable
as $$
  -- Extrai o primeiro segmento do path (company_id)
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

create or replace function public.can_access_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Concede se houver um arquivo cadastrado com esse path e o usuário puder lê-lo
  select exists (
    select 1
    from public.files f
    where f.bucket_id = 'documents'
      and f.storage_path = object_name
      and public.can_read_file(f.id)
  );
$$;

-- Políticas do Storage (bucket documents)
-- Baixar/visualizar
create policy "read documents with file permission"
on storage.objects
for select to authenticated
using (
  bucket_id = 'documents'
  and public.can_access_object(name)
);

-- Upload
create policy "company admins can upload to documents"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'documents'
  and public.is_company_admin(public.object_company_id(name))
);

-- Atualizar/Deletar
create policy "company admins can manage their objects"
on storage.objects
for all to authenticated
using (
  bucket_id = 'documents'
  and public.is_company_admin(public.object_company_id(name))
)
with check (
  bucket_id = 'documents'
  and public.is_company_admin(public.object_company_id(name))
);

-- RLS para tabelas principais já habilitado acima; faltava para storage.objects (já habilitado por padrão pelo Supabase)

-- RLS em profiles: permitir Super Admin selecionar todos já criado
-- RLS em companies/members/folders/files criados acima

-- Políticas de leitura adicionais
create policy "super admins read all companies" on public.companies
for select to authenticated
using (public.has_role(auth.uid(),'super_admin'));
