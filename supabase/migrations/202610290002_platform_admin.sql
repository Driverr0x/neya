-- Équipe NEYA : validation des structures depuis l'application.
-- Un administrateur est un compte ordinaire inscrit dans cette table (ajout uniquement en SQL).

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public, anon, authenticated;
grant select, insert, update, delete on public.platform_admins to service_role;

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = auth.uid());
$$;

create function public.admin_list_structures()
returns table (
  id uuid,
  name text,
  city text,
  phone text,
  address text,
  approval_status public.structure_status,
  created_at timestamptz,
  owner_email text,
  doctor_count bigint
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
    select s.id, s.name, s.city, s.phone, s.address, s.approval_status, s.created_at,
      u.email::text,
      (select count(*) from public.profiles p where p.structure_id = s.id and p.role = 'doctor')
    from public.structures s
    left join auth.users u on u.id = s.owner_id
    order by s.created_at desc;
end;
$$;

create function public.admin_set_structure_status(p_structure_id uuid, p_status public.structure_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only the NEYA team can review structures';
  end if;
  update public.structures set approval_status = p_status where id = p_structure_id;
  if not found then
    raise exception 'Structure not found';
  end if;
end;
$$;

revoke execute on function public.is_platform_admin() from public, anon;
revoke execute on function public.admin_list_structures() from public, anon;
revoke execute on function public.admin_set_structure_status(uuid, public.structure_status) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.admin_list_structures() to authenticated;
grant execute on function public.admin_set_structure_status(uuid, public.structure_status) to authenticated;
