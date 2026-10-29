-- Code de récupération des visiteuses (sans compte) : il permet de retrouver conversations,
-- rendez-vous, inscriptions et résumés sur un autre téléphone. La visiteuse reste anonyme :
-- le code transfère ses données de l'ancienne session anonyme vers la nouvelle.

create table public.visitor_recovery_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Seule l'empreinte SHA-256 du code est conservée, jamais le code lui-même.
  code_hash text not null unique,
  created_at timestamptz not null default now()
);

alter table public.visitor_recovery_codes enable row level security;
revoke all on public.visitor_recovery_codes from anon, authenticated;
grant select, insert, update, delete on public.visitor_recovery_codes to service_role;

-- Limite les essais de code : 5 par quart d'heure et par session.
create table public.recovery_attempts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0
);

alter table public.recovery_attempts enable row level security;
revoke all on public.recovery_attempts from anon, authenticated;
grant select, insert, update, delete on public.recovery_attempts to service_role;

create function public.consume_recovery_attempt(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  insert into public.recovery_attempts (user_id, window_started_at, attempt_count)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update
  set window_started_at = case
        when public.recovery_attempts.window_started_at < now() - interval '15 minutes' then now()
        else public.recovery_attempts.window_started_at
      end,
      attempt_count = case
        when public.recovery_attempts.window_started_at < now() - interval '15 minutes' then 1
        else public.recovery_attempts.attempt_count + 1
      end
  returning attempt_count into current_count;

  return current_count <= 5;
end;
$$;

revoke all on function public.consume_recovery_attempt(uuid) from public, anon, authenticated;
grant execute on function public.consume_recovery_attempt(uuid) to service_role;

-- Transfère tout ce qui appartient à l'ancienne session visiteuse vers la nouvelle.
create function public.transfer_visitor_data(p_from uuid, p_to uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  duplicate record;
  moved_conversations integer;
  moved_bookings integer;
  moved_referrals integer;
begin
  if p_from = p_to then
    raise exception 'Recovery code belongs to this phone';
  end if;
  if (select count(*) from public.profiles
      where id in (p_from, p_to) and role = 'patient' and status = 'active') <> 2 then
    raise exception 'Recovery is only available for visitor sessions';
  end if;

  -- Une conversation avec le même professionnel existe déjà sur le nouveau téléphone :
  -- ses messages rejoignent l'ancienne conversation, qui garde l'historique.
  for duplicate in
    select old_c.id as keep_id, new_c.id as drop_id
    from public.conversations old_c
    join public.conversations new_c
      on new_c.doctor_id = old_c.doctor_id and new_c.patient_id = p_to
    where old_c.patient_id = p_from
  loop
    update public.messages set conversation_id = duplicate.keep_id where conversation_id = duplicate.drop_id;
    delete from public.conversations where id = duplicate.drop_id;
  end loop;

  update public.conversations set patient_id = p_to where patient_id = p_from;
  get diagnostics moved_conversations = row_count;
  update public.messages set sender_id = p_to where sender_id = p_from;

  -- Même inscription à un dépistage des deux côtés : on garde la plus ancienne.
  delete from public.bookings new_b
  using public.bookings old_b
  where new_b.patient_id = p_to
    and old_b.patient_id = p_from
    and new_b.screening_event_id is not null
    and new_b.screening_event_id = old_b.screening_event_id;
  update public.bookings set patient_id = p_to where patient_id = p_from;
  get diagnostics moved_bookings = row_count;

  update public.referrals set patient_id = p_to where patient_id = p_from;
  get diagnostics moved_referrals = row_count;

  delete from public.visitor_recovery_codes where user_id = p_from;

  return jsonb_build_object(
    'conversations', moved_conversations,
    'bookings', moved_bookings,
    'referrals', moved_referrals
  );
end;
$$;

revoke all on function public.transfer_visitor_data(uuid, uuid) from public, anon, authenticated;
grant execute on function public.transfer_visitor_data(uuid, uuid) to service_role;
