
-- Storage policies for bucket 'documents'
-- Nota: usamos funções já existentes: public.object_company_id(text) e public.can_access_object(text)

-- 1) Leitura: membros podem ler objetos permitidos
drop policy if exists "documents: members read allowed objects" on storage.objects;
create policy "documents: members read allowed objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and public.can_access_object(name)
);

-- 2) Upload (INSERT): apenas super_admin ou company_admin da empresa do path
drop policy if exists "documents: admins upload objects" on storage.objects;
create policy "documents: admins upload objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.is_company_admin(public.object_company_id(name))
  )
);

-- 3) Update: mesmos critérios (precisa USING e WITH CHECK)
drop policy if exists "documents: admins update objects" on storage.objects;
create policy "documents: admins update objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documents'
  and (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.is_company_admin(public.object_company_id(name))
  )
)
with check (
  bucket_id = 'documents'
  and (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.is_company_admin(public.object_company_id(name))
  )
);

-- 4) Delete: mesmos critérios
drop policy if exists "documents: admins delete objects" on storage.objects;
create policy "documents: admins delete objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.is_company_admin(public.object_company_id(name))
  )
);
