-- Enable extension
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'employee',
  employee_id text unique,
  location text,
  birthday date,
  age int,
  gender text,
  civil_status text,
  sss text,
  philhealth text,
  pagibig text,
  tin text,
  position text,
  start_date date,
  shift text,
  supervisor text,
  signature_url text,
  signature_status text not null default 'Pending Review',
  created_at timestamptz default now()
);

create table if not exists public.dtr_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cutoff text not null,
  selected_dtr_date date,
  employee_note text,
  admin_remarks text,
  file_url text not null,
  status text not null default 'Pending Review',
  approved_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  file_url text not null,
  review_status text not null default 'Pending Review',
  created_at timestamptz default now()
);

create table if not exists public.employee_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_full_name text,
  requested_avatar_url text,
  requested_birthday date,
  requested_age int,
  requested_gender text,
  requested_civil_status text,
  requested_sss text,
  requested_philhealth text,
  requested_pagibig text,
  requested_tin text,
  status text not null default 'Pending Review',
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.profiles
  add column if not exists signature_status text not null default 'Pending Review';

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.employee_documents
  add column if not exists review_status text not null default 'Pending Review';

alter table public.dtr_submissions
  add column if not exists selected_dtr_date date;

alter table public.dtr_submissions
  add column if not exists approved_at timestamptz;

alter table public.dtr_submissions
  add column if not exists employee_note text;

alter table public.dtr_submissions
  add column if not exists admin_remarks text;

alter table public.profile_change_requests
  add column if not exists requested_birthday date;

alter table public.profile_change_requests
  add column if not exists requested_age int;

alter table public.profile_change_requests
  add column if not exists requested_gender text;

alter table public.profile_change_requests
  add column if not exists requested_civil_status text;

alter table public.profile_change_requests
  add column if not exists requested_sss text;

alter table public.profile_change_requests
  add column if not exists requested_philhealth text;

alter table public.profile_change_requests
  add column if not exists requested_pagibig text;

alter table public.profile_change_requests
  add column if not exists requested_tin text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dtr_submissions_user_id_profile_fkey'
  ) then
    alter table public.dtr_submissions
      add constraint dtr_submissions_user_id_profile_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'employee_documents_user_id_profile_fkey'
  ) then
    alter table public.employee_documents
      add constraint employee_documents_user_id_profile_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_change_requests_user_id_profile_fkey'
  ) then
    alter table public.profile_change_requests
      add constraint profile_change_requests_user_id_profile_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'employee_presence_user_id_profile_fkey'
  ) then
    alter table public.employee_presence
      add constraint employee_presence_user_id_profile_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_signature_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_signature_status_check
      check (signature_status in ('Pending Review', 'Verified', 'Needs Reupload'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'employee_documents_review_status_check'
  ) then
    alter table public.employee_documents
      add constraint employee_documents_review_status_check
      check (review_status in ('Pending Review', 'Verified', 'Needs Reupload'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_change_requests_status_check'
  ) then
    alter table public.profile_change_requests
      add constraint profile_change_requests_status_check
      check (status in ('Pending Review', 'Approved', 'Rejected'));
  end if;
end
$$;

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_location on public.profiles(location);
create index if not exists idx_dtr_submissions_user_id on public.dtr_submissions(user_id);
create index if not exists idx_dtr_submissions_status on public.dtr_submissions(status);
create index if not exists idx_dtr_submissions_created_at on public.dtr_submissions(created_at desc);
create index if not exists idx_dtr_submissions_selected_dtr_date on public.dtr_submissions(selected_dtr_date desc);
create index if not exists idx_dtr_submissions_approved_at on public.dtr_submissions(approved_at desc);
create index if not exists idx_employee_documents_user_id on public.employee_documents(user_id);
create index if not exists idx_employee_documents_review_status on public.employee_documents(review_status);
create index if not exists idx_employee_presence_last_seen_at on public.employee_presence(last_seen_at desc);
create index if not exists idx_profile_change_requests_user_id on public.profile_change_requests(user_id);
create index if not exists idx_profile_change_requests_status on public.profile_change_requests(status);
create index if not exists idx_profile_change_requests_created_at on public.profile_change_requests(created_at desc);

alter table public.profiles enable row level security;
alter table public.dtr_submissions enable row level security;
alter table public.employee_documents enable row level security;
alter table public.employee_presence enable row level security;
alter table public.profile_change_requests enable row level security;

-- Avoid RLS recursion by checking admin role through a SECURITY DEFINER function.
create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if check_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.profiles
    where id = check_user_id
      and role = 'admin'
  );
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

drop policy if exists "users_can_select_own_profile" on public.profiles;
create policy "users_can_select_own_profile"
on public.profiles for select
using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "users_can_upsert_own_profile" on public.profiles;
create policy "users_can_upsert_own_profile"
on public.profiles for all
using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "users_can_manage_own_dtr" on public.dtr_submissions;
create policy "users_can_manage_own_dtr"
on public.dtr_submissions for all
using (auth.uid() = user_id or public.is_admin(auth.uid()))
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "users_can_manage_own_documents" on public.employee_documents;
create policy "users_can_manage_own_documents"
on public.employee_documents for all
using (auth.uid() = user_id or public.is_admin(auth.uid()))
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "users_can_manage_own_presence" on public.employee_presence;
create policy "users_can_manage_own_presence"
on public.employee_presence for all
using (auth.uid() = user_id or public.is_admin(auth.uid()))
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "users_can_manage_own_profile_change_requests" on public.profile_change_requests;
create policy "users_can_manage_own_profile_change_requests"
on public.profile_change_requests for all
using (auth.uid() = user_id or public.is_admin(auth.uid()))
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

-- --------------------------------------
-- Storage Buckets + Strict Access Policies
-- --------------------------------------
-- Buckets are private by default. Client apps must use signed URLs for controlled sharing.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('dtr-images', 'dtr-images', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('documents', 'documents', false, 15728640, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- NOTE:
-- Do not run `alter table storage.objects ...` here.
-- In many Supabase projects, `storage.objects` is owned by a managed role,
-- and running ALTER TABLE from SQL editor can fail with:
-- "must be owner of table objects".
-- Storage RLS is managed by Supabase; create policies directly instead.

-- dtr-images: only owner and admins can read/write/delete.
drop policy if exists "dtr_owner_or_admin_select" on storage.objects;
create policy "dtr_owner_or_admin_select"
on storage.objects for select
using (
  bucket_id = 'dtr-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin(auth.uid())
  )
);

drop policy if exists "dtr_owner_or_admin_insert" on storage.objects;
create policy "dtr_owner_or_admin_insert"
on storage.objects for insert
with check (
  bucket_id = 'dtr-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin(auth.uid())
  )
);

drop policy if exists "dtr_owner_or_admin_update" on storage.objects;
create policy "dtr_owner_or_admin_update"
on storage.objects for update
using (
  bucket_id = 'dtr-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin(auth.uid())
  )
)
with check (
  bucket_id = 'dtr-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin(auth.uid())
  )
);

drop policy if exists "dtr_owner_or_admin_delete" on storage.objects;
create policy "dtr_owner_or_admin_delete"
on storage.objects for delete
using (
  bucket_id = 'dtr-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin(auth.uid())
  )
);

-- documents: private HR documents (owner + admins only).
drop policy if exists "documents_owner_or_admin_select" on storage.objects;
create policy "documents_owner_or_admin_select"
on storage.objects for select
using (
  bucket_id = 'documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin(auth.uid())
  )
);

drop policy if exists "documents_owner_or_admin_insert" on storage.objects;
create policy "documents_owner_or_admin_insert"
on storage.objects for insert
with check (
  bucket_id = 'documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin(auth.uid())
  )
);

drop policy if exists "documents_owner_or_admin_update" on storage.objects;
create policy "documents_owner_or_admin_update"
on storage.objects for update
using (
  bucket_id = 'documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin(auth.uid())
  )
)
with check (
  bucket_id = 'documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin(auth.uid())
  )
);

drop policy if exists "documents_owner_or_admin_delete" on storage.objects;
create policy "documents_owner_or_admin_delete"
on storage.objects for delete
using (
  bucket_id = 'documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin(auth.uid())
  )
);
