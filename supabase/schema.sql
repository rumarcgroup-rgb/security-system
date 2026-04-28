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
  edited_at timestamptz,
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

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  table_name text not null,
  record_id uuid,
  target_user_id uuid references public.profiles(id) on delete set null,
  summary text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
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

alter table public.message_messages
  add column if not exists edited_at timestamptz;

alter table public.message_read_states
  add column if not exists last_read_message_id uuid;

alter table public.message_read_states
  add column if not exists last_read_at timestamptz default now();

alter table public.message_read_states
  add column if not exists updated_at timestamptz default now();

update public.profiles
set branch = 'Main'
where branch is null or trim(branch) = '';

update public.profiles
set role = 'super_admin'
where role = 'admin';

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
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('employee', 'supervisor', 'super_admin', 'admin_ops', 'admin'));
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
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_table_name on public.audit_logs(table_name);
create index if not exists idx_audit_logs_target_user_id on public.audit_logs(target_user_id);

alter table public.profiles enable row level security;
alter table public.dtr_submissions enable row level security;
alter table public.employee_documents enable row level security;
alter table public.employee_presence enable row level security;
alter table public.profile_change_requests enable row level security;
alter table public.message_threads enable row level security;
alter table public.message_messages enable row level security;
alter table public.message_read_states enable row level security;
alter table public.audit_logs enable row level security;

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

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'audit_logs'
    ) then
      alter publication supabase_realtime add table public.audit_logs;
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
      and role in ('admin', 'super_admin', 'admin_ops')
  );
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

create or replace function public.is_super_admin(check_user_id uuid default auth.uid())
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
      and role in ('super_admin', 'admin')
  );
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_super_admin(uuid) from public;
grant execute on function public.is_super_admin(uuid) to authenticated, service_role;

create or replace function public.is_admin_ops(check_user_id uuid default auth.uid())
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
      and role = 'admin_ops'
  );
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_admin_ops(uuid) from public;
grant execute on function public.is_admin_ops(uuid) to authenticated, service_role;

create or replace function public.is_any_admin(check_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return public.is_super_admin(check_user_id) or public.is_admin_ops(check_user_id);
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_any_admin(uuid) from public;
grant execute on function public.is_any_admin(uuid) to authenticated, service_role;

create or replace function public.get_admin_system_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  required_realtime_tables text[] := array[
    'dtr_submissions',
    'employee_documents',
    'profile_change_requests',
    'profiles',
    'employee_presence',
    'message_threads',
    'message_messages',
    'message_read_states',
    'audit_logs'
  ];
  realtime_enabled boolean;
  realtime_tables jsonb;
  current_profile_role text;
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'Super admin access required.';
  end if;

  select role
  into current_profile_role
  from public.profiles
  where id = auth.uid();

  select exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  into realtime_enabled;

  select coalesce(jsonb_agg(tablename order by tablename), '[]'::jsonb)
  into realtime_tables
  from pg_publication_tables
  where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = any(required_realtime_tables);

  return jsonb_build_object(
    'checked_at', now(),
    'profile_id', auth.uid(),
    'profile_role', coalesce(current_profile_role, 'unknown'),
    'realtime_publication_exists', realtime_enabled,
    'required_realtime_tables', to_jsonb(required_realtime_tables),
    'enabled_realtime_tables', realtime_tables,
    'missing_realtime_tables',
      (
        select coalesce(jsonb_agg(required_table), '[]'::jsonb)
        from unnest(required_realtime_tables) as required_table
        where not exists (
          select 1
          from pg_publication_tables
          where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = required_table
        )
      )
  );
exception
  when others then
    return jsonb_build_object(
      'checked_at', now(),
      'profile_id', auth.uid(),
      'profile_role', coalesce(current_profile_role, 'unknown'),
      'realtime_publication_exists', false,
      'required_realtime_tables', to_jsonb(required_realtime_tables),
      'enabled_realtime_tables', '[]'::jsonb,
      'missing_realtime_tables', to_jsonb(required_realtime_tables),
      'error', sqlerrm
    );
end;
$$;

revoke all on function public.get_admin_system_health() from public;
grant execute on function public.get_admin_system_health() to authenticated, service_role;

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

create or replace function public.is_supervisor_for_employee(
  target_user_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  target_location text;
  target_branch text;
  target_role text;
  target_supervisor_user_id uuid;
begin
  if target_user_id is null or check_user_id is null then
    return false;
  end if;

  select
    location,
    branch,
    role,
    supervisor_user_id
  into
    target_location,
    target_branch,
    target_role,
    target_supervisor_user_id
  from public.profiles
  where id = target_user_id;

  if not found or public.is_any_admin(target_user_id) then
    return false;
  end if;

  if target_supervisor_user_id = check_user_id and public.is_supervisor(check_user_id) then
    return true;
  end if;

  return public.is_supervisor_for_scope(target_location, target_branch, check_user_id);
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_supervisor_for_employee(uuid, uuid) from public;
grant execute on function public.is_supervisor_for_employee(uuid, uuid) to authenticated, service_role;

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
          public.is_any_admin(check_user_id)
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
      when profile_role in ('admin', 'super_admin', 'admin_ops') then 'admin'
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

create or replace function public.sync_message_thread_after_message_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  latest_message_id uuid;
begin
  if coalesce(new.body, '') = coalesce(old.body, '') then
    return new;
  end if;

  select id
  into latest_message_id
  from public.message_messages
  where thread_id = new.thread_id
  order by created_at desc, id desc
  limit 1;

  if latest_message_id = new.id then
    update public.message_threads
    set last_message_preview = left(new.body, 140)
    where id = new.thread_id;
  end if;

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

drop trigger if exists message_messages_sync_thread_after_update on public.message_messages;
create trigger message_messages_sync_thread_after_update
after update of body, edited_at on public.message_messages
for each row execute function public.sync_message_thread_after_message_update();

create or replace function public.edit_message(target_message_id uuid, next_body text)
returns public.message_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_message public.message_messages;
  latest_own_message_id uuid;
  trimmed_body text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  trimmed_body := btrim(coalesce(next_body, ''));
  if char_length(trimmed_body) = 0 then
    raise exception 'Message cannot be empty.';
  end if;

  select *
  into updated_message
  from public.message_messages
  where id = target_message_id;

  if not found then
    raise exception 'Message not found.';
  end if;

  if updated_message.sender_user_id <> auth.uid() then
    raise exception 'You can only edit your own message.';
  end if;

  if not public.can_access_message_thread(updated_message.thread_id, auth.uid()) then
    raise exception 'You do not have access to edit this message.';
  end if;

  select id
  into latest_own_message_id
  from public.message_messages
  where thread_id = updated_message.thread_id
    and sender_user_id = auth.uid()
  order by created_at desc, id desc
  limit 1;

  if latest_own_message_id is distinct from target_message_id then
    raise exception 'Only your latest message can be edited.';
  end if;

  if trimmed_body = btrim(coalesce(updated_message.body, '')) then
    return updated_message;
  end if;

  update public.message_messages
  set
    body = trimmed_body,
    edited_at = now()
  where id = target_message_id
  returning * into updated_message;

  return updated_message;
end;
$$;

revoke all on function public.edit_message(uuid, text) from public;
grant execute on function public.edit_message(uuid, text) to authenticated, service_role;

create or replace function public.employee_reupload_dtr_submission(
  target_submission_id uuid,
  next_file_url text,
  next_employee_note text default null
)
returns public.dtr_submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_submission public.dtr_submissions;
  trimmed_file_url text;
  trimmed_note text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  trimmed_file_url := btrim(coalesce(next_file_url, ''));
  trimmed_note := nullif(btrim(coalesce(next_employee_note, '')), '');

  if trimmed_file_url = '' then
    raise exception 'Replacement DTR file is required.';
  end if;

  if left(trimmed_file_url, char_length(auth.uid()::text) + 1) <> auth.uid()::text || '/' then
    raise exception 'Replacement DTR file must be uploaded under your own folder.';
  end if;

  select *
  into updated_submission
  from public.dtr_submissions
  where id = target_submission_id;

  if not found then
    raise exception 'DTR submission not found.';
  end if;

  if updated_submission.user_id <> auth.uid() then
    raise exception 'You can only reupload your own DTR.';
  end if;

  if updated_submission.submitted_by_role <> 'employee'
    or coalesce(updated_submission.submitted_by_user_id, updated_submission.user_id) <> auth.uid()
  then
    raise exception 'Only guard-submitted DTRs can be reuploaded by the guard.';
  end if;

  if updated_submission.status not in ('Pending Review', 'Rejected') then
    raise exception 'Only pending or rejected DTRs can be reuploaded.';
  end if;

  update public.dtr_submissions
  set
    file_url = trimmed_file_url,
    employee_note = trimmed_note,
    admin_remarks = null,
    status = 'Pending Review',
    approved_at = null
  where id = target_submission_id
  returning * into updated_submission;

  return updated_submission;
end;
$$;

revoke all on function public.employee_reupload_dtr_submission(uuid, text, text) from public;
grant execute on function public.employee_reupload_dtr_submission(uuid, text, text) to authenticated, service_role;

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

create or replace function public.employee_deescalate_message_thread(target_thread_id uuid)
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
      and supervisor_user_id is not null
      and escalated_to_admin = true
  ) then
    raise exception 'You do not have access to turn off admin escalation for this thread.';
  end if;

  update public.message_threads
  set
    escalated_to_admin = false,
    escalated_by_user_id = null,
    escalated_at = null
  where id = target_thread_id
  returning * into next_thread;

  return next_thread;
end;
$$;

revoke all on function public.employee_deescalate_message_thread(uuid) from public;
grant execute on function public.employee_deescalate_message_thread(uuid) to authenticated, service_role;

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
          public.is_any_admin(auth.uid())
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

create or replace function public.write_business_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_row jsonb;
  previous_row jsonb;
  next_row jsonb;
  audit_record_id uuid;
  audit_target_user_id uuid;
  audit_summary text;
begin
  if TG_OP = 'DELETE' then
    source_row := to_jsonb(old);
    previous_row := to_jsonb(old);
    next_row := null;
  else
    source_row := to_jsonb(new);
    previous_row := case when TG_OP = 'UPDATE' then to_jsonb(old) else null end;
    next_row := to_jsonb(new);
  end if;

  audit_record_id := nullif(source_row ->> 'id', '')::uuid;

  audit_target_user_id :=
    case TG_TABLE_NAME
      when 'profiles' then nullif(source_row ->> 'id', '')::uuid
      when 'dtr_submissions' then nullif(source_row ->> 'user_id', '')::uuid
      when 'employee_documents' then nullif(source_row ->> 'user_id', '')::uuid
      when 'profile_change_requests' then nullif(source_row ->> 'user_id', '')::uuid
      when 'message_threads' then nullif(source_row ->> 'employee_user_id', '')::uuid
      when 'message_messages' then nullif(source_row ->> 'sender_user_id', '')::uuid
      else null
    end;

  audit_summary :=
    case TG_TABLE_NAME
      when 'dtr_submissions' then
        case
          when TG_OP = 'INSERT' then 'DTR submission created.'
          when TG_OP = 'UPDATE' and old.status is distinct from new.status then
            'DTR status changed from ' || coalesce(old.status, 'blank') || ' to ' || coalesce(new.status, 'blank') || '.'
          else 'DTR submission updated.'
        end
      when 'employee_documents' then
        case
          when TG_OP = 'INSERT' then 'Requirement uploaded.'
          when TG_OP = 'UPDATE' and old.review_status is distinct from new.review_status then
            'Requirement status changed from ' || coalesce(old.review_status, 'blank') || ' to ' || coalesce(new.review_status, 'blank') || '.'
          else 'Requirement updated.'
        end
      when 'profile_change_requests' then
        case
          when TG_OP = 'INSERT' then 'Profile change request created.'
          when TG_OP = 'UPDATE' and old.status is distinct from new.status then
            'Profile change request changed from ' || coalesce(old.status, 'blank') || ' to ' || coalesce(new.status, 'blank') || '.'
          else 'Profile change request updated.'
        end
      when 'profiles' then
        case
          when TG_OP = 'INSERT' then 'Profile created.'
          when TG_OP = 'UPDATE' and (
            old.role is distinct from new.role
            or old.location is distinct from new.location
            or old.branch is distinct from new.branch
            or old.supervisor_user_id is distinct from new.supervisor_user_id
            or old.position is distinct from new.position
          ) then 'Role or assignment updated.'
          else 'Profile updated.'
        end
      when 'message_threads' then
        case
          when TG_OP = 'INSERT' then 'Message thread created.'
          when TG_OP = 'UPDATE' and old.escalated_to_admin = false and new.escalated_to_admin = true then 'Message thread escalated to admin.'
          when TG_OP = 'UPDATE' and old.escalated_to_admin = true and new.escalated_to_admin = false then 'Message thread admin escalation turned off.'
          when TG_OP = 'UPDATE' and old.status is distinct from new.status then 'Message thread status changed.'
          else 'Message thread updated.'
        end
      when 'message_messages' then
        case
          when TG_OP = 'INSERT' then 'Message sent.'
          when TG_OP = 'UPDATE' and old.body is distinct from new.body then 'Message edited.'
          else 'Message updated.'
        end
      else TG_TABLE_NAME || ' ' || lower(TG_OP) || '.'
    end;

  insert into public.audit_logs (
    actor_user_id,
    event_type,
    table_name,
    record_id,
    target_user_id,
    summary,
    old_data,
    new_data
  )
  values (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    audit_record_id,
    audit_target_user_id,
    audit_summary,
    previous_row,
    next_row
  );

  if TG_OP = 'DELETE' then
    return old;
  end if;

  return new;
exception
  when others then
    if TG_OP = 'DELETE' then
      return old;
    end if;

    return new;
end;
$$;

drop trigger if exists audit_profiles_business_changes on public.profiles;
create trigger audit_profiles_business_changes
after insert or update on public.profiles
for each row execute function public.write_business_audit_log();

drop trigger if exists audit_dtr_submissions_business_changes on public.dtr_submissions;
create trigger audit_dtr_submissions_business_changes
after insert or update or delete on public.dtr_submissions
for each row execute function public.write_business_audit_log();

drop trigger if exists audit_employee_documents_business_changes on public.employee_documents;
create trigger audit_employee_documents_business_changes
after insert or update or delete on public.employee_documents
for each row execute function public.write_business_audit_log();

drop trigger if exists audit_profile_change_requests_business_changes on public.profile_change_requests;
create trigger audit_profile_change_requests_business_changes
after insert or update or delete on public.profile_change_requests
for each row execute function public.write_business_audit_log();

drop trigger if exists audit_message_threads_business_changes on public.message_threads;
create trigger audit_message_threads_business_changes
after insert or update or delete on public.message_threads
for each row execute function public.write_business_audit_log();

drop trigger if exists audit_message_messages_business_changes on public.message_messages;
create trigger audit_message_messages_business_changes
after insert or update or delete on public.message_messages
for each row execute function public.write_business_audit_log();

drop policy if exists "users_can_select_own_profile" on public.profiles;
create policy "users_can_select_own_profile"
on public.profiles for select
using (
  auth.uid() = id
  or public.is_any_admin(auth.uid())
  or public.is_supervisor_for_employee(id, auth.uid())
);

drop policy if exists "users_can_upsert_own_profile" on public.profiles;
create policy "users_can_upsert_own_profile"
on public.profiles for all
using (auth.uid() = id or public.is_super_admin(auth.uid()))
with check (auth.uid() = id or public.is_super_admin(auth.uid()));

drop policy if exists "users_can_manage_own_dtr" on public.dtr_submissions;
drop policy if exists "users_can_select_scoped_dtr" on public.dtr_submissions;
create policy "users_can_select_scoped_dtr"
on public.dtr_submissions for select
using (
  auth.uid() = user_id
  or public.is_any_admin(auth.uid())
  or public.is_supervisor_for_employee(user_id, auth.uid())
);

drop policy if exists "users_can_insert_scoped_dtr" on public.dtr_submissions;
create policy "users_can_insert_scoped_dtr"
on public.dtr_submissions for insert
with check (
  auth.uid() = user_id
  or public.is_any_admin(auth.uid())
  or public.is_supervisor_for_employee(user_id, auth.uid())
);

drop policy if exists "admins_and_supervisors_can_update_dtr" on public.dtr_submissions;
create policy "admins_and_supervisors_can_update_dtr"
on public.dtr_submissions for update
using (
  public.is_any_admin(auth.uid())
  or public.is_supervisor_for_employee(user_id, auth.uid())
)
with check (
  public.is_any_admin(auth.uid())
  or public.is_supervisor_for_employee(user_id, auth.uid())
);

drop policy if exists "admins_can_delete_dtr" on public.dtr_submissions;
create policy "admins_can_delete_dtr"
on public.dtr_submissions for delete
using (public.is_super_admin(auth.uid()));

drop policy if exists "users_can_manage_own_documents" on public.employee_documents;
create policy "users_can_manage_own_documents"
on public.employee_documents for all
using (
  auth.uid() = user_id
  or public.is_any_admin(auth.uid())
  or public.is_supervisor_for_employee(user_id, auth.uid())
)
with check (
  auth.uid() = user_id
  or public.is_any_admin(auth.uid())
  or public.is_supervisor_for_employee(user_id, auth.uid())
);

drop policy if exists "users_can_manage_own_presence" on public.employee_presence;
create policy "users_can_manage_own_presence"
on public.employee_presence for all
using (
  auth.uid() = user_id
  or public.is_any_admin(auth.uid())
  or public.is_supervisor_for_employee(user_id, auth.uid())
)
with check (
  auth.uid() = user_id
  or public.is_any_admin(auth.uid())
  or public.is_supervisor_for_employee(user_id, auth.uid())
);

drop policy if exists "users_can_manage_own_profile_change_requests" on public.profile_change_requests;
create policy "users_can_manage_own_profile_change_requests"
on public.profile_change_requests for all
using (auth.uid() = user_id or public.is_super_admin(auth.uid()))
with check (auth.uid() = user_id or public.is_super_admin(auth.uid()));

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
using (public.is_any_admin(auth.uid()))
with check (public.is_any_admin(auth.uid()));

drop policy if exists "admins_can_delete_message_threads" on public.message_threads;
create policy "admins_can_delete_message_threads"
on public.message_threads for delete
using (public.is_super_admin(auth.uid()));

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
using (public.is_super_admin(auth.uid()));

drop policy if exists "message_thread_participants_can_select_read_states" on public.message_read_states;
create policy "message_thread_participants_can_select_read_states"
on public.message_read_states for select
using (public.can_access_message_thread(thread_id, auth.uid()));

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

drop policy if exists "admins_can_select_audit_logs" on public.audit_logs;
create policy "admins_can_select_audit_logs"
on public.audit_logs for select
using (public.is_super_admin(auth.uid()));

drop policy if exists "service_role_can_manage_audit_logs" on public.audit_logs;
create policy "service_role_can_manage_audit_logs"
on public.audit_logs for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

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
    or public.is_any_admin(auth.uid())
    or exists (
      select 1
      from public.profiles
      where id::text = (storage.foldername(name))[1]
        and public.is_supervisor_for_employee(id, auth.uid())
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
    or public.is_any_admin(auth.uid())
    or exists (
      select 1
      from public.profiles
      where id::text = (storage.foldername(name))[1]
        and public.is_supervisor_for_employee(id, auth.uid())
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
    or public.is_super_admin(auth.uid())
  )
)
with check (
  bucket_id = 'dtr-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_super_admin(auth.uid())
  )
);

drop policy if exists "dtr_owner_or_admin_delete" on storage.objects;
create policy "dtr_owner_or_admin_delete"
on storage.objects for delete
using (
  bucket_id = 'dtr-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_super_admin(auth.uid())
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
    or public.is_any_admin(auth.uid())
    or exists (
      select 1
      from public.profiles
      where id::text = (storage.foldername(name))[1]
        and public.is_supervisor_for_employee(id, auth.uid())
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
    or public.is_any_admin(auth.uid())
  )
);

drop policy if exists "documents_owner_or_admin_update" on storage.objects;
create policy "documents_owner_or_admin_update"
on storage.objects for update
using (
  bucket_id = 'documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_super_admin(auth.uid())
  )
)
with check (
  bucket_id = 'documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_super_admin(auth.uid())
  )
);

drop policy if exists "documents_owner_or_admin_delete" on storage.objects;
create policy "documents_owner_or_admin_delete"
on storage.objects for delete
using (
  bucket_id = 'documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_super_admin(auth.uid())
  )
);
