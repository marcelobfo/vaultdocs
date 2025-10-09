
-- 1) Permitir que company_admin gerencie vínculos de usuários à sua empresa
-- Mantém a política de super_admin e adiciona uma para admins da empresa
create policy "company admins manage memberships of their companies"
on public.user_companies
as permissive
for all
to authenticated
using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));

-- 2) Permitir que company_admin leiam e gerenciem account_requests da sua empresa
-- Leitura para admins da empresa cujo desired_company_id = empresa onde ele é admin
create policy "company admins read requests for their company"
on public.account_requests
as permissive
for select
to authenticated
using (
  desired_company_id is not null
  and public.is_company_admin(desired_company_id)
);

-- Atualização (aprovar/rejeitar) para admins da empresa
create policy "company admins manage requests for their company"
on public.account_requests
as permissive
for update
to authenticated
using (public.is_company_admin(desired_company_id))
with check (public.is_company_admin(desired_company_id));

-- 3) Permitir que company_admin leiam tokens de push dos usuários que pertencem à sua empresa
-- A regra checa se existe algum vínculo do dono do token (ps.user_id) com alguma empresa
-- onde o usuário atual seja company_admin
create policy "company admins read push tokens of their company users"
on public.push_subscriptions as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.user_companies uc_token
    join public.user_companies uc_admin
      on uc_token.company_id = uc_admin.company_id
    where uc_token.user_id = push_subscriptions.user_id
      and uc_admin.user_id = auth.uid()
      and uc_admin.role = 'company_admin'
  )
);

-- Observações:
-- - Não removemos políticas existentes; apenas adicionamos de forma 'permissive'.
-- - As funções public.is_company_admin e public.is_company_member já existem no projeto.
