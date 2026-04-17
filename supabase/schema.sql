-- Enable extension
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'employee',
  employee_id text unique,
  location text,
  branch text,
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

create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid not null references public.profiles(id) on delete cascade,
  supervisor_user_id uuid references public.profiles(id) on delete set null,
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open',
  escalated_to_admin boolean not null default false,
  escalated_by_user_id uuid references public.profiles(id) on delete set null,
  escalated_at timestamptz,
  last_message_at timestamptz default now(),
  last_message_sender_user_id uuid references public.profiles(id) on delete set null,
  last_message_preview text,
  created_at timestamptz default now()
);

create table if not exists public.message_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null default 'employee',
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.message_read_states (
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_message_id uuid references public.message_messages(id) on delete set null,
  last_read_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (thread_id, user_id)
);

alter table public.profiles
  add column if not exists signature_status text not null default 'Pending Review';

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists branch text;

alter table public.profiles
  add column if not exists supervisor_user_id uuid;

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

alter table public.dtr_submissions
  add column if not exists submitted_by_role text not null default 'employee';

alter table public.dtr_submissions
  add column if not exists submitted_by_user_id uuid references auth.users(id) on delete set null;

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

alter table public.message_threads
  add column if not exists status text not null default 'open';

alter table public.message_threads
  add column if not exists escalated_to_admin boolean not null default false;

alter table public.message_threads
  add column if not exists escalated_by_user_id uuid;

alter table public.message_threads
  add column if not exists escalated_at timestamptz;

alter table public.message_threads
  add column if not exists last_message_at timestamptz default now();

alter table public.message_threads
  add column if not exists last_message_sender_user_id uuid;

alter table public.message_threads
  add column if not exists last_message_preview text;

alter table public.message_messages
  add column if not exists sender_role text not null default 'employee';

alter table public.message_messages
  add column if not exists body text;

alter table public.message_read_states
  add column if not exists last_read_message_id uuid;

alter table public.message_read_states
  add column if not exists last_read_at timestamptz default now();

alter table public.message_read_states
  add column if not exists updated_at timestamptz default now();

update public.profiles
set branch = 'Main'
where branch is null or trim(branch) = '';

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
    where conname = 'profiles_supervisor_user_id_profile_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_supervisor_user_id_profile_fkey
      foreign key (supervisor_user_id) references public.profiles(id) on delete set null;
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

  if not exists (
    select 1
    from pg_constraint
    where conname = 'dtr_submissions_submitted_by_role_check'
  ) then
    alter table public.dtr_submissions
      add constraint dtr_submissions_submitted_by_role_check
      check (submitted_by_role in ('employee', 'supervisor'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'message_threads_status_check'
  ) then
    alter table public.message_threads
      add constraint message_threads_status_check
      check (status in ('open', 'resolved'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'message_messages_sender_role_check'
  ) then
    alter table public.message_messages
      add constraint message_messages_sender_role_check
      check (sender_role in ('employee', 'supervisor', 'admin'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'message_messages_body_check'
  ) then
    alter table public.message_messages
      add constraint message_messages_body_check
      check (char_length(btrim(coalesce(body, ''))) > 0);
  end if;
end
$$;

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_location on public.profiles(location);
create index if not exists idx_profiles_branch on public.profiles(branch);
create index if not exists idx_profiles_supervisor_user_id on public.profiles(supervisor_user_id);
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
create index if not exists idx_message_threads_employee_user_id on public.message_threads(employee_user_id);
create index if not exists idx_message_threads_supervisor_user_id on public.message_threads(supervisor_user_id);
create index if not exists idx_message_threads_status on public.message_threads(status);
create index if not exists idx_message_threads_last_message_at on public.message_threads(last_message_at desc);
create unique index if not exists idx_message_threads_open_route_unique
  on public.message_threads (
    employee_user_id,
    coalesce(supervisor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'open';
create index if not exists idx_message_messages_thread_id on public.message_messages(thread_id, created_at);
create index if not exists idx_message_messages_sender_user_id on public.message_messages(sender_user_id);
create index if not exists idx_message_read_states_user_id on public.message_read_states(user_id);

alter table public.profiles enable row level security;
alter table public.dtr_submissions enable row level security;
alter table public.employee_documents enable row level security;
alter table public.employee_presence enable row level security;
alter table public.profile_change_requests enable row level security;
alter table public.message_threads enable row level security;
alter table public.message_messages enable row level security;
alter table public.message_read_states enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'dtr_submissions'
    ) then
      alter publication supabase_realtime add table public.dtr_submissions;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'employee_documents'
    ) then
      alter publication supabase_realtime add table public.employee_documents;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profile_change_requests'
    ) then
      alter publication supabase_realtime add table public.profile_change_requests;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profiles'
    ) then
      alter publication supabase_realtime add table public.profiles;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'employee_presence'
    ) then
      alter publication supabase_realtime add table public.employee_presence;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'message_threads'
    ) then
      alter publication supabase_realtime add table public.message_threads;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'message_messages'
    ) then
      alter publication supabase_realtime add table public.message_messages;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'message_read_states'
    ) then
      alter publication supabase_realtime add table public.message_read_states;
    end if;
  end if;
end
$$;

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

create or replace function public.is_supervisor(check_user_id uuid default auth.uid())
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
      and role = 'supervisor'
  );
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_supervisor(uuid) from public;
grant execute on function public.is_supervisor(uuid) to authenticated, service_role;

create or replace function public.is_supervisor_for_scope(
  target_location text,
  target_branch text default null,
  check_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  supervisor_location text;
  supervisor_branch text;
begin
  if check_user_id is null or target_location is null then
    return false;
  end if;

  select
    location,
    nullif(trim(branch), '')
  into
    supervisor_location,
    supervisor_branch
  from public.profiles
  where id = check_user_id
    and role = 'supervisor';

  if supervisor_location is null then
    return false;
  end if;

  if supervisor_location <> target_location then
    return false;
  end if;

  if supervisor_branch is null then
    return true;
  end if;

  return supervisor_branch = nullif(trim(target_branch), '');
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_supervisor_for_scope(text, text, uuid) from public;
grant execute on function public.is_supervisor_for_scope(text, text, uuid) to authenticated, service_role;

create or replace function public.can_access_message_thread(
  target_thread_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if target_thread_id is null or check_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.message_threads thread
    where thread.id = target_thread_id
      and (
        thread.employee_user_id = check_user_id
        or thread.supervisor_user_id = check_user_id
        or (
          public.is_admin(check_user_id)
          and (thread.supervisor_user_id is null or thread.escalated_to_admin)
        )
      )
  );
exception
  when others then
    return false;
end;
$$;

revoke all on function public.can_access_message_thread(uuid, uuid) from public;
grant execute on function public.can_access_message_thread(uuid, uuid) to authenticated, service_role;

create or replace function public.can_create_message_thread(
  target_employee_user_id uuid,
  target_supervisor_user_id uuid,
  creator_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  employee_supervisor_user_id uuid;
  supervisor_role text;
begin
  if target_employee_user_id is null or creator_user_id is null then
    return false;
  end if;

  if target_employee_user_id <> creator_user_id then
    return false;
  end if;

  select supervisor_user_id
  into employee_supervisor_user_id
  from public.profiles
  where id = target_employee_user_id;

  if not found then
    return false;
  end if;

  if target_supervisor_user_id is null then
    return employee_supervisor_user_id is null;
  end if;

  if employee_supervisor_user_id is distinct from target_supervisor_user_id then
    return false;
  end if;

  select role
  into supervisor_role
  from public.profiles
  where id = target_supervisor_user_id;

  return supervisor_role = 'supervisor';
exception
  when others then
    return false;
end;
$$;

revoke all on function public.can_create_message_thread(uuid, uuid, uuid) from public;
grant execute on function public.can_create_message_thread(uuid, uuid, uuid) to authenticated, service_role;

create or replace function public.assign_message_sender_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_role text;
begin
  select role into profile_role
  from public.profiles
  where id = new.sender_user_id;

  new.sender_role :=
    case
      when profile_role = 'admin' then 'admin'
      when profile_role = 'supervisor' then 'supervisor'
      else 'employee'
    end;

  return new;
end;
$$;

create or replace function public.sync_message_thread_after_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.message_threads
  set
    last_message_at = new.created_at,
    last_message_sender_user_id = new.sender_user_id,
    last_message_preview = left(new.body, 140),
    status = 'open'
  where id = new.thread_id;

  return new;
end;
$$;

drop trigger if exists message_messages_assign_sender_role on public.message_messages;
create trigger message_messages_assign_sender_role
before insert on public.message_messages
for each row execute function public.assign_message_sender_role();

drop trigger if exists message_messages_sync_thread_after_insert on public.message_messages;
create trigger message_messages_sync_thread_after_insert
after insert on public.message_messages
for each row execute function public.sync_message_thread_after_message_insert();

create or replace function public.employee_escalate_message_thread(target_thread_id uuid)
returns public.message_threads
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_thread public.message_threads;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.message_threads
    where id = target_thread_id
      and employee_user_id = auth.uid()
  ) then
    raise exception 'You do not have access to escalate this thread.';
  end if;

  update public.message_threads
  set
    escalated_to_admin = true,
    escalated_by_user_id = auth.uid(),
    escalated_at = coalesce(escalated_at, now())
  where id = target_thread_id
  returning * into next_thread;

  return next_thread;
end;
$$;

revoke all on function public.employee_escalate_message_thread(uuid) from public;
grant execute on function public.employee_escalate_message_thread(uuid) to authenticated, service_role;

create or replace function public.resolve_message_thread(target_thread_id uuid)
returns public.message_threads
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_thread public.message_threads;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.message_threads
    where id = target_thread_id
      and (
        supervisor_user_id = auth.uid()
        or (
          public.is_admin(auth.uid())
          and (supervisor_user_id is null or escalated_to_admin)
        )
      )
  ) then
    raise exception 'You do not have access to resolve this thread.';
  end if;

  update public.message_threads
  set status = 'resolved'
  where id = target_thread_id
  returning * into next_thread;

  return next_thread;
end;
$$;

revoke all on function public.resolve_message_thread(uuid) from public;
grant execute on function public.resolve_message_thread(uuid) to authenticated, service_role;

drop policy if exists "users_can_select_own_profile" on public.profiles;
create policy "users_can_select_own_profile"
on public.profiles for select
using (
  auth.uid() = id
  or public.is_admin(auth.uid())
  or public.is_supervisor_for_scope(location, branch, auth.uid())
);

drop policy if exists "users_can_upsert_own_profile" on public.profiles;
create policy "users_can_upsert_own_profile"
on public.profiles for all
using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "users_can_manage_own_dtr" on public.dtr_submissions;
create policy "users_can_manage_own_dtr"
on public.dtr_submissions for all
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
  or public.is_supervisor_for_scope(
    (select location from public.profiles where id = user_id),
    (select branch from public.profiles where id = user_id),
    auth.uid()
  )
)
with check (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
  or public.is_supervisor_for_scope(
    (select location from public.profiles where id = user_id),
    (select branch from public.profiles where id = user_id),
    auth.uid()
  )
);

drop policy if exists "users_can_manage_own_documents" on public.employee_documents;
create policy "users_can_manage_own_documents"
on public.employee_documents for all
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
  or public.is_supervisor_for_scope(
    (select location from public.profiles where id = user_id),
    (select branch from public.profiles where id = user_id),
    auth.uid()
  )
)
with check (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
  or public.is_supervisor_for_scope(
    (select location from public.profiles where id = user_id),
    (select branch from public.profiles where id = user_id),
    auth.uid()
  )
);

drop policy if exists "users_can_manage_own_presence" on public.employee_presence;
create policy "users_can_manage_own_presence"
on public.employee_presence for all
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
  or public.is_supervisor_for_scope(
    (select location from public.profiles where id = user_id),
    (select branch from public.profiles where id = user_id),
    auth.uid()
  )
)
with check (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
  or public.is_supervisor_for_scope(
    (select location from public.profiles where id = user_id),
    (select branch from public.profiles where id = user_id),
    auth.uid()
  )
);

drop policy if exists "users_can_manage_own_profile_change_requests" on public.profile_change_requests;
create policy "users_can_manage_own_profile_change_requests"
on public.profile_change_requests for all
using (auth.uid() = user_id or public.is_admin(auth.uid()))
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "message_thread_participants_can_select" on public.message_threads;
create policy "message_thread_participants_can_select"
on public.message_threads for select
using (public.can_access_message_thread(id, auth.uid()));

drop policy if exists "employees_can_create_message_threads" on public.message_threads;
create policy "employees_can_create_message_threads"
on public.message_threads for insert
with check (
  auth.uid() = public.message_threads.employee_user_id
  and auth.uid() = public.message_threads.created_by_user_id
  and public.can_create_message_thread(
    public.message_threads.employee_user_id,
    public.message_threads.supervisor_user_id,
    auth.uid()
  )
);

drop policy if exists "admins_can_update_message_threads" on public.message_threads;
create policy "admins_can_update_message_threads"
on public.message_threads for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "admins_can_delete_message_threads" on public.message_threads;
create policy "admins_can_delete_message_threads"
on public.message_threads for delete
using (public.is_admin(auth.uid()));

drop policy if exists "message_thread_participants_can_select_messages" on public.message_messages;
create policy "message_thread_participants_can_select_messages"
on public.message_messages for select
using (public.can_access_message_thread(thread_id, auth.uid()));

drop policy if exists "message_thread_participants_can_insert_messages" on public.message_messages;
create policy "message_thread_participants_can_insert_messages"
on public.message_messages for insert
with check (
  public.can_access_message_thread(thread_id, auth.uid())
  and sender_user_id = auth.uid()
);

drop policy if exists "admins_can_delete_messages" on public.message_messages;
create policy "admins_can_delete_messages"
on public.message_messages for delete
using (public.is_admin(auth.uid()));

drop policy if exists "users_can_manage_own_message_read_states" on public.message_read_states;
create policy "users_can_manage_own_message_read_states"
on public.message_read_states for all
using (
  user_id = auth.uid()
  and public.can_access_message_thread(thread_id, auth.uid())
)
with check (
  user_id = auth.uid()
  and public.can_access_message_thread(thread_id, auth.uid())
);

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
    or exists (
      select 1
      from public.profiles
      where id::text = (storage.foldername(name))[1]
        and public.is_supervisor_for_scope(location, branch, auth.uid())
    )
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
    or exists (
      select 1
      from public.profiles
      where id::text = (storage.foldername(name))[1]
        and public.is_supervisor_for_scope(location, branch, auth.uid())
    )
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
    or exists (
      select 1
      from public.profiles
      where id::text = (storage.foldername(name))[1]
        and public.is_supervisor_for_scope(location, branch, auth.uid())
    )
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
