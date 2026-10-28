create type public.account_role as enum ('patient', 'structure_admin', 'doctor');
create type public.account_status as enum ('active', 'pending', 'disabled');
create type public.structure_status as enum ('pending', 'approved', 'rejected');
create type public.booking_kind as enum ('appointment', 'screening');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.account_role not null default 'patient',
  status public.account_status not null default 'active',
  display_name text not null default '',
  phone text,
  structure_id uuid,
  specialty text check (specialty is null or specialty in ('sage-femme', 'medecin', 'psychologue')),
  languages text[] not null default array['fr']::text[]
    check (languages <@ array['fr', 'moore', 'dioula']::text[]),
  bio text,
  created_at timestamptz not null default now(),
  constraint profile_name_length check (char_length(display_name) <= 120),
  constraint profile_phone_length check (phone is null or char_length(phone) <= 32)
);

create table public.structures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete restrict,
  name text not null,
  city text not null,
  phone text not null,
  address text,
  approval_status public.structure_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint structure_name_length check (char_length(name) between 2 and 160),
  constraint structure_city_length check (char_length(city) between 2 and 100),
  constraint structure_phone_length check (char_length(phone) between 5 and 32)
);

alter table public.profiles
  add constraint profiles_structure_fk
  foreign key (structure_id) references public.structures (id) on delete set null;

create table public.doctor_invites (
  token_hash text primary key,
  structure_id uuid not null references public.structures (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  expires_at timestamptz not null,
  redeemed_by uuid references public.profiles (id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.screening_events (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null references public.structures (id) on delete cascade,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '',
  free boolean not null default true,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint screening_time_order check (ends_at > starts_at),
  constraint screening_title_length check (char_length(title) between 2 and 160),
  constraint screening_description_length check (char_length(description) <= 1200),
  constraint screening_location_length check (char_length(location) <= 200)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete restrict,
  structure_id uuid not null references public.structures (id) on delete restrict,
  screening_event_id uuid references public.screening_events (id) on delete set null,
  kind public.booking_kind not null,
  full_name text not null,
  phone text not null,
  slot_label text,
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  constraint booking_name_length check (char_length(full_name) between 2 and 120),
  constraint booking_phone_length check (char_length(phone) between 5 and 32),
  constraint booking_details check (
    (kind = 'screening' and screening_event_id is not null and slot_label is null)
    or (kind = 'appointment' and screening_event_id is null and slot_label is not null)
  )
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.profiles (id) on delete restrict,
  structure_id uuid not null references public.structures (id) on delete restrict,
  title text not null,
  description text not null default '',
  language text not null default 'fr' check (language in ('fr', 'moore', 'dioula')),
  storage_path text not null unique,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint video_title_length check (char_length(title) between 2 and 160),
  constraint video_description_length check (char_length(description) <= 2000)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete restrict,
  doctor_id uuid not null references public.profiles (id) on delete restrict,
  structure_id uuid not null references public.structures (id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  unique (patient_id, doctor_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  content text not null default '',
  audio_path text,
  created_at timestamptz not null default now(),
  constraint message_content_length check (char_length(content) <= 5000),
  constraint message_has_content check (char_length(trim(content)) > 0 or audio_path is not null)
);

create function public.register_structure_account(
  p_user_id uuid,
  p_name text,
  p_city text,
  p_phone text,
  p_address text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_structure_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'patient' and status = 'active'
  ) then
    raise exception 'This account cannot register a structure';
  end if;

  insert into public.structures (owner_id, name, city, phone, address)
  values (p_user_id, trim(p_name), trim(p_city), trim(p_phone), nullif(trim(p_address), ''))
  returning id into new_structure_id;

  update public.profiles
  set role = 'structure_admin', display_name = trim(p_name)
  where id = p_user_id;

  return new_structure_id;
end;
$$;

create function public.redeem_doctor_invite(
  p_user_id uuid,
  p_token_hash text,
  p_display_name text,
  p_phone text,
  p_specialty text,
  p_languages text[],
  p_bio text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invited_structure_id uuid;
begin
  select i.structure_id into invited_structure_id
  from public.doctor_invites i
  join public.structures s on s.id = i.structure_id
  where i.token_hash = p_token_hash
    and i.redeemed_at is null
    and i.expires_at > now()
    and s.approval_status = 'approved'
  for update of i;

  if invited_structure_id is null
    or p_specialty not in ('sage-femme', 'medecin', 'psychologue')
    or coalesce(cardinality(p_languages), 0) = 0
    or not (p_languages <@ array['fr', 'moore', 'dioula']::text[])
    or char_length(trim(p_display_name)) not between 2 and 120
    or char_length(coalesce(p_bio, '')) > 1000 then
    raise exception 'Invitation is invalid, expired, or already used';
  end if;

  update public.profiles
  set role = 'doctor',
      status = 'active',
      display_name = trim(p_display_name),
      phone = nullif(trim(p_phone), ''),
      structure_id = invited_structure_id,
      specialty = p_specialty,
      languages = p_languages,
      bio = coalesce(trim(p_bio), '')
  where id = p_user_id and role = 'patient' and status = 'active';

  if not found then
    raise exception 'This account cannot join a structure';
  end if;

  update public.doctor_invites
  set redeemed_by = p_user_id, redeemed_at = now()
  where token_hash = p_token_hash;

  return invited_structure_id;
end;
$$;

revoke all on function public.register_structure_account(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.redeem_doctor_invite(uuid, text, text, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.register_structure_account(uuid, text, text, text, text) to service_role;
grant execute on function public.redeem_doctor_invite(uuid, text, text, text, text, text[], text) to service_role;

create index bookings_structure_created_idx on public.bookings (structure_id, created_at desc);
create unique index bookings_single_screening_registration_idx
  on public.bookings (patient_id, screening_event_id)
  where screening_event_id is not null;
create index videos_structure_created_idx on public.videos (structure_id, created_at desc);
create index conversations_doctor_created_idx on public.conversations (doctor_id, created_at desc);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);

create table public.ai_request_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
);

create function public.consume_ai_request(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  insert into public.ai_request_limits (user_id, window_started_at, request_count)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update
  set window_started_at = case
        when public.ai_request_limits.window_started_at < now() - interval '1 minute' then now()
        else public.ai_request_limits.window_started_at
      end,
      request_count = case
        when public.ai_request_limits.window_started_at < now() - interval '1 minute' then 1
        else public.ai_request_limits.request_count + 1
      end
  returning request_count into current_count;

  return current_count <= 5;
end;
$$;

revoke all on function public.consume_ai_request(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_request(uuid) to service_role;

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, status)
  values (new.id, 'patient', 'active')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create function public.prevent_profile_privilege_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() = old.id and (
    new.role is distinct from old.role
    or new.status is distinct from old.status
    or new.structure_id is distinct from old.structure_id
  ) then
    raise exception 'Account role, status, and structure are managed by the platform';
  end if;
  return new;
end;
$$;

create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_changes();

create function public.is_active_doctor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    join public.structures s on s.id = p.structure_id
    where p.id = auth.uid()
      and p.role = 'doctor'
      and p.status = 'active'
      and s.approval_status = 'approved'
  );
$$;

create function public.is_approved_structure_admin(target_structure uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    join public.structures s on s.owner_id = p.id
    where p.id = auth.uid()
      and p.role = 'structure_admin'
      and p.status = 'active'
      and s.id = target_structure
      and s.approval_status = 'approved'
  );
$$;

grant execute on function public.is_active_doctor() to authenticated;
grant execute on function public.is_approved_structure_admin(uuid) to authenticated;

create function public.update_booking_status(p_booking_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('confirmed', 'cancelled', 'completed') then
    raise exception 'Invalid booking status';
  end if;

  update public.bookings b
  set status = p_status
  where b.id = p_booking_id
    and public.is_approved_structure_admin(b.structure_id);

  if not found then
    raise exception 'Booking not found or access denied';
  end if;
end;
$$;

revoke all on function public.update_booking_status(uuid, text) from public, anon, authenticated;
grant execute on function public.update_booking_status(uuid, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.structures enable row level security;
alter table public.doctor_invites enable row level security;
alter table public.screening_events enable row level security;
alter table public.bookings enable row level security;
alter table public.videos enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.ai_request_limits enable row level security;

grant usage on schema public to authenticated, service_role;
grant select on public.profiles to authenticated;
grant update (display_name, phone) on public.profiles to authenticated;
grant select on public.structures to authenticated;
grant select, insert, update, delete on public.screening_events to authenticated;
grant select, insert on public.bookings to authenticated;
grant select, insert, update, delete on public.videos to authenticated;
grant select, insert on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.doctor_invites to service_role;
grant select, insert, update, delete on public.ai_request_limits to service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.structures to service_role;
grant select, insert, update, delete on public.screening_events to service_role;
grant select, insert, update, delete on public.bookings to service_role;
grant select, insert, update, delete on public.videos to service_role;
grant select, insert, update, delete on public.conversations to service_role;
grant select, insert, update, delete on public.messages to service_role;

create policy "Profiles are visible to their owner and active doctor directory"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (
      role = 'doctor'
      and status = 'active'
      and exists (
        select 1 from public.structures s
        where s.id = profiles.structure_id and s.approval_status = 'approved'
      )
    )
    or public.is_approved_structure_admin(structure_id)
  );

create policy "Users can update their contact profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Approved structures are public"
  on public.structures for select to authenticated
  using (approval_status = 'approved' or owner_id = auth.uid());

create policy "Structure admins manage their screenings"
  on public.screening_events for all to authenticated
  using (public.is_approved_structure_admin(structure_id))
  with check (public.is_approved_structure_admin(structure_id));

create policy "Published screenings are public"
  on public.screening_events for select to authenticated
  using (
    published and exists (
      select 1 from public.structures s
      where s.id = screening_events.structure_id and s.approval_status = 'approved'
    )
  );

create policy "Patients create bookings for themselves"
  on public.bookings for insert to authenticated
  with check (
    patient_id = auth.uid()
    and status = 'requested'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'patient' and p.status = 'active'
    )
    and exists (
      select 1 from public.structures s
      where s.id = bookings.structure_id and s.approval_status = 'approved'
    )
    and (
      screening_event_id is null
      or exists (
        select 1 from public.screening_events e
        where e.id = bookings.screening_event_id
          and e.structure_id = bookings.structure_id
          and e.published
          and e.ends_at > now()
      )
    )
  );

create policy "Patients and their structure can view bookings"
  on public.bookings for select to authenticated
  using (patient_id = auth.uid() or public.is_approved_structure_admin(structure_id));

create policy "Published videos are public"
  on public.videos for select to authenticated
  using (
    published and exists (
      select 1 from public.structures s
      where s.id = videos.structure_id and s.approval_status = 'approved'
    )
  );

create policy "Doctors view and manage their own videos"
  on public.videos for all to authenticated
  using (doctor_id = auth.uid() and public.is_active_doctor())
  with check (
    doctor_id = auth.uid()
    and public.is_active_doctor()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.structure_id = videos.structure_id
    )
  );

create policy "Structure admins view their doctors' videos"
  on public.videos for select to authenticated
  using (public.is_approved_structure_admin(structure_id));

create policy "Patients create conversations with active doctors"
  on public.conversations for insert to authenticated
  with check (
    patient_id = auth.uid()
    and status = 'open'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'patient' and p.status = 'active'
    )
    and exists (
      select 1 from public.profiles d
      join public.structures s on s.id = d.structure_id
      where d.id = conversations.doctor_id
        and d.structure_id = conversations.structure_id
        and d.role = 'doctor'
        and d.status = 'active'
        and s.approval_status = 'approved'
    )
  );

create policy "Conversation participants can view conversations"
  on public.conversations for select to authenticated
  using (
    (patient_id = auth.uid() and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'patient' and p.status = 'active'
    ))
    or (doctor_id = auth.uid() and public.is_active_doctor())
  );

create policy "Conversation participants can view messages"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (
          (c.patient_id = auth.uid() and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'patient' and p.status = 'active'
          ))
          or (c.doctor_id = auth.uid() and public.is_active_doctor())
        )
    )
  );

create policy "Conversation participants can send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.status = 'open'
        and (
          (c.patient_id = auth.uid() and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'patient' and p.status = 'active'
          ))
          or (c.doctor_id = auth.uid() and public.is_active_doctor())
        )
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('neya-videos', 'neya-videos', false, 104857600, array['video/mp4', 'video/webm', 'video/quicktime']),
  ('neya-audio', 'neya-audio', false, 10485760, array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg'])
on conflict (id) do nothing;

create policy "Active doctors upload videos to their structure folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'neya-videos'
    and public.is_active_doctor()
    and (storage.foldername(name))[1] = (
      select p.structure_id::text from public.profiles p where p.id = auth.uid()
    )
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Published videos and their owners can read video files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'neya-videos'
    and exists (
      select 1 from public.videos v
      where v.storage_path = storage.objects.name
        and (
          (v.published and exists (
            select 1 from public.structures s
            where s.id = v.structure_id and s.approval_status = 'approved'
          ))
          or v.doctor_id = auth.uid()
          or public.is_approved_structure_admin(v.structure_id)
        )
    )
  );

create policy "Doctors manage their own video files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'neya-videos'
    and public.is_active_doctor()
    and (storage.foldername(name))[1] = (
      select p.structure_id::text from public.profiles p where p.id = auth.uid()
    )
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Participants upload audio to their conversation"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'neya-audio'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (c.patient_id = auth.uid() or c.doctor_id = auth.uid())
    )
  );

create policy "Participants read audio from their conversation"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'neya-audio'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (c.patient_id = auth.uid() or c.doctor_id = auth.uid())
    )
  );

create policy "Owners delete their audio files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'neya-audio'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

alter publication supabase_realtime add table public.messages;
