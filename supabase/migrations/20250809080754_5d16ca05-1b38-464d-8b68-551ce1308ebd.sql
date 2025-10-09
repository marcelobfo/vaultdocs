
-- 1) Função para adicionar (ou atualizar) um usuário em uma empresa pelo e-mail
-- - Busca o user_id em auth.users
-- - Insere em public.user_companies com o papel informado (viewer | company_admin)
-- - Se já existir, atualiza o papel
-- - SECURITY DEFINER para permitir lookup em auth.users a partir do cliente
create or replace function public.add_user_to_company_by_email(
  _email text,
  _company_id uuid,
  _role app_role default 'viewer'
) returns void
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

  insert into public.user_companies(user_id, company_id, role)
  values (_uid, _company_id, _role)
  on conflict (user_id, company_id) do update
    set role = excluded.role;
end;
$$;

comment on function public.add_user_to_company_by_email(text, uuid, app_role)
  is 'Adiciona/atualiza associação de usuário à empresa pelo e-mail, com papel informado.';


-- 2) Permitir que super_admin também possa inserir registros na tabela files
--    Mantém a exigência de created_by = auth.uid()
drop policy if exists "admins insert files" on public.files;

create policy "admins insert files"
on public.files
for insert
to authenticated
with check (
  (public.is_company_admin(company_id) or public.has_role(auth.uid(), 'super_admin'::app_role))
  and created_by = auth.uid()
);
