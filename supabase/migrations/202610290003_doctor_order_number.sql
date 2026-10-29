-- Médecins vérifiés par leur numéro d'ordre (Ordre des médecins, des sages-femmes…).
-- Un médecin qui rejoint une structure reste « pending » (invisible des utilisatrices) jusqu'à ce que
-- l'équipe NEYA vérifie son numéro d'ordre depuis l'écran Équipe NEYA.

alter table public.profiles
  add column order_number text,
  add column order_verified_at timestamptz,
  add constraint profile_order_number_length
    check (order_number is null or char_length(order_number) between 3 and 40);

-- Le numéro d'ordre et sa vérification ne se modifient pas depuis le compte lui-même.
create or replace function public.prevent_profile_privilege_changes()
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
    or new.order_number is distinct from old.order_number
    or new.order_verified_at is distinct from old.order_verified_at
  ) then
    raise exception 'Account role, status, and structure are managed by the platform';
  end if;
  return new;
end;
$$;

drop function public.redeem_doctor_invite(uuid, text, text, text, text, text[], text);

create function public.redeem_doctor_invite(
  p_user_id uuid,
  p_token_hash text,
  p_display_name text,
  p_phone text,
  p_specialty text,
  p_languages text[],
  p_bio text,
  p_order_number text
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
    or char_length(trim(coalesce(p_order_number, ''))) not between 3 and 40
    or char_length(coalesce(p_bio, '')) > 1000 then
    raise exception 'Invitation is invalid, expired, or already used';
  end if;

  update public.profiles
  set role = 'doctor',
      status = 'pending',
      display_name = trim(p_display_name),
      phone = nullif(trim(p_phone), ''),
      structure_id = invited_structure_id,
      specialty = p_specialty,
      languages = p_languages,
      bio = coalesce(trim(p_bio), ''),
      order_number = trim(p_order_number),
      order_verified_at = null
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

revoke all on function public.redeem_doctor_invite(uuid, text, text, text, text, text[], text, text) from public, anon, authenticated;
grant execute on function public.redeem_doctor_invite(uuid, text, text, text, text, text[], text, text) to service_role;

-- Écran Équipe NEYA : liste des médecins et vérification du numéro d'ordre.
create function public.admin_list_doctors()
returns table (
  id uuid,
  display_name text,
  specialty text,
  phone text,
  order_number text,
  order_verified_at timestamptz,
  status public.account_status,
  structure_name text,
  structure_city text,
  email text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only the NEYA team can review structures';
  end if;
  return query
    select p.id, p.display_name, p.specialty, p.phone, p.order_number, p.order_verified_at, p.status,
      s.name, s.city, u.email::text, p.created_at
    from public.profiles p
    left join public.structures s on s.id = p.structure_id
    left join auth.users u on u.id = p.id
    where p.role = 'doctor'
    order by p.created_at desc;
end;
$$;

create function public.admin_set_doctor_status(p_doctor_id uuid, p_status public.account_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only the NEYA team can review structures';
  end if;
  update public.profiles
  set status = p_status,
      order_verified_at = case when p_status = 'active' then now() else null end
  where id = p_doctor_id and role = 'doctor';
  if not found then
    raise exception 'Doctor not found';
  end if;
end;
$$;

revoke execute on function public.admin_list_doctors() from public, anon;
revoke execute on function public.admin_set_doctor_status(uuid, public.account_status) from public, anon;
grant execute on function public.admin_list_doctors() to authenticated;
grant execute on function public.admin_set_doctor_status(uuid, public.account_status) to authenticated;
