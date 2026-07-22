-- JUMP METRICS • Atualização 07 — sistema completo guiado
-- Execute UMA VEZ no Supabase > SQL Editor.
-- Pode ser executado mesmo que as atualizações anteriores já tenham sido aplicadas.

create extension if not exists pgcrypto;

-- Organização oficial
insert into public.organizations (name, slug)
values ('Studio Jump Alta Performance', 'studio-jump-alta-performance')
on conflict (slug) do update set name = excluded.name;

-- ID público e perfil atlético
create sequence if not exists public.assessee_public_id_seq start with 1;
create or replace function public.generate_assessee_public_id()
returns text language plpgsql volatile security definer set search_path = public as $$
begin
  return 'JM-' || lpad(nextval('public.assessee_public_id_seq')::text, 6, '0');
end; $$;

alter table public.assessees add column if not exists public_id text;
alter table public.assessees add column if not exists athletic_profile text;
update public.assessees set athletic_profile='Não atlético'
where athletic_profile is null or athletic_profile not in ('Atlético','Elite','Não atlético');
alter table public.assessees alter column athletic_profile set default 'Não atlético';
alter table public.assessees alter column athletic_profile set not null;
alter table public.assessees drop constraint if exists assessees_athletic_profile_check;
alter table public.assessees add constraint assessees_athletic_profile_check
check (athletic_profile in ('Atlético','Elite','Não atlético'));
update public.assessees set public_id=public.generate_assessee_public_id()
where public_id is null or btrim(public_id)='';
alter table public.assessees alter column public_id set default public.generate_assessee_public_id();
alter table public.assessees alter column public_id set not null;
create unique index if not exists assessees_public_id_unique_idx on public.assessees(public_id);

-- Dados completos da avaliação
alter table public.evaluations add column if not exists assessment_protocol text;
alter table public.evaluations add column if not exists systolic_bp_mmhg numeric(6,2);
alter table public.evaluations add column if not exists diastolic_bp_mmhg numeric(6,2);
alter table public.evaluations add column if not exists resting_heart_rate_bpm numeric(6,2);
alter table public.evaluations add column if not exists blood_oxygen_saturation_percent numeric(5,2);
alter table public.evaluations add column if not exists neck_cm numeric(6,2);
alter table public.evaluations add column if not exists shoulder_cm numeric(6,2);
alter table public.evaluations add column if not exists chest_cm numeric(6,2);
alter table public.evaluations add column if not exists biceps_cm numeric(6,2);
alter table public.evaluations add column if not exists thigh_cm numeric(6,2);
alter table public.evaluations add column if not exists waist_cm numeric(6,2);
alter table public.evaluations add column if not exists hip_cm numeric(6,2);
alter table public.evaluations add column if not exists calf_cm numeric(6,2);

-- Fotos, laudos e anexos
alter table public.evaluation_photos drop constraint if exists evaluation_photos_photo_type_check;
alter table public.evaluation_photos add constraint evaluation_photos_photo_type_check
check (photo_type in ('front','side','back','other','photo','bodymetrix','attachment'));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('assessment-files','assessment-files',false,26214400,array[
  'image/jpeg','image/png','image/webp','application/pdf','text/csv',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
on conflict (id) do update set public=false,file_size_limit=26214400,allowed_mime_types=excluded.allowed_mime_types;

-- Função de acesso profissional exclusivo
create or replace function public.bootstrap_professional_access()
returns uuid language plpgsql security definer set search_path=public as $$
declare v_email text; v_org uuid;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  v_email:=lower(coalesce(auth.jwt()->>'email',''));
  if v_email<>'studiojumpmetrics@gmail.com' then return null; end if;
  insert into public.organizations(name,slug)
  values('Studio Jump Alta Performance','studio-jump-alta-performance')
  on conflict(slug) do update set name=excluded.name returning id into v_org;
  if v_org is null then select id into v_org from public.organizations where slug='studio-jump-alta-performance'; end if;
  insert into public.profiles(id,full_name,email)
  values(auth.uid(),'Prof. André de Sá',v_email)
  on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,updated_at=now();
  insert into public.memberships(organization_id,user_id,role)
  values(v_org,auth.uid(),'owner')
  on conflict(organization_id,user_id) do update set role='owner';
  return v_org;
end; $$;
revoke all on function public.bootstrap_professional_access() from public;
grant execute on function public.bootstrap_professional_access() to authenticated;

-- Vínculo automático do aluno pelo e-mail cadastrado
create or replace function public.claim_assessee_by_email()
returns integer language plpgsql security definer set search_path=public as $$
declare n integer; user_email text;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  user_email:=lower(coalesce(auth.jwt()->>'email',''));
  if user_email='' then return 0; end if;
  update public.assessees set account_user_id=auth.uid(),updated_at=now()
  where account_user_id is null and lower(coalesce(email,''))=user_email;
  get diagnostics n=row_count; return n;
end; $$;
revoke all on function public.claim_assessee_by_email() from public;
grant execute on function public.claim_assessee_by_email() to authenticated;

-- Confirma políticas do Storage para profissional e aluno
-- O RLS de storage.objects já é gerenciado e habilitado pelo Supabase.
-- Não execute ALTER TABLE nessa tabela, pois ela pertence ao serviço de Storage.
drop policy if exists "staff uploads private assessment files" on storage.objects;
create policy "staff uploads private assessment files" on storage.objects
for insert to authenticated with check (
  bucket_id='assessment-files' and public.is_org_staff((storage.foldername(name))[1]::uuid)
);
drop policy if exists "authorized users read private assessment files" on storage.objects;
create policy "authorized users read private assessment files" on storage.objects
for select to authenticated using (
  bucket_id='assessment-files' and (
    public.is_org_staff((storage.foldername(name))[1]::uuid)
    or public.owns_assessee((storage.foldername(name))[2]::uuid)
  )
);
drop policy if exists "owner deletes private assessment files" on storage.objects;
create policy "owner deletes private assessment files" on storage.objects
for delete to authenticated using (
  bucket_id='assessment-files' and public.is_org_owner((storage.foldername(name))[1]::uuid)
);

-- A criação livre de ambiente profissional continua desativada.
revoke all on function public.create_organization(text) from public;
revoke all on function public.create_organization(text) from authenticated;
