-- Résumé de l'évaluation envoyé à une structure avec l'accord exprès de l'utilisatrice,
-- puis suivi du cas par la structure (reçu → contactée → suspect → confirmé ou écarté).

create type public.case_status as enum ('received', 'contacted', 'suspected', 'confirmed', 'ruled_out');

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  structure_id uuid not null references public.structures (id) on delete restrict,
  full_name text not null,
  phone text not null,
  level smallint not null check (level between 1 and 3),
  title text not null,
  reasons text[] not null default array[]::text[],
  age_range text,
  symptoms text[] not null default array[]::text[],
  language text not null,
  city text,
  -- Moment où l'utilisatrice a coché l'accord : sans lui, aucun résumé n'est enregistré.
  consent_at timestamptz not null,
  case_status public.case_status not null default 'received',
  follow_up_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_name_length check (char_length(full_name) between 2 and 120),
  constraint referral_phone_length check (char_length(phone) between 5 and 32),
  constraint referral_title_length check (char_length(title) <= 160),
  constraint referral_reasons_count check (cardinality(reasons) <= 8 and cardinality(symptoms) <= 8),
  constraint referral_language check (language in ('fr', 'en', 'moore', 'dioula')),
  constraint referral_note_length check (follow_up_note is null or char_length(follow_up_note) <= 2000)
);

create index referrals_structure_created_idx on public.referrals (structure_id, created_at desc);

alter table public.referrals enable row level security;
grant select, insert on public.referrals to authenticated;
grant select, insert, update, delete on public.referrals to service_role;

-- L'utilisatrice (session visiteuse) envoie son propre résumé, à une structure validée, avec son accord.
create policy "Patients send their own referral with consent"
  on public.referrals for insert to authenticated
  with check (
    patient_id = auth.uid()
    and case_status = 'received'
    and follow_up_note is null
    and consent_at is not null
    and consent_at <= now() + interval '5 minutes'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'patient' and p.status = 'active'
    )
    and exists (
      select 1 from public.structures s
      where s.id = referrals.structure_id and s.approval_status = 'approved'
    )
  );

-- Seule la structure destinataire lit les résumés (l'utilisatrice garde sa copie sur son téléphone).
create policy "Structures read the referrals sent to them"
  on public.referrals for select to authenticated
  using (public.is_approved_structure_admin(structure_id));

-- Le suivi du cas passe par cette fonction : la structure ne peut rien modifier d'autre.
create function public.update_referral_case(p_referral_id uuid, p_status public.case_status, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(coalesce(p_note, '')) > 2000 then
    raise exception 'Follow-up note is too long';
  end if;

  update public.referrals r
  set case_status = p_status,
      follow_up_note = nullif(trim(coalesce(p_note, '')), ''),
      updated_at = now()
  where r.id = p_referral_id
    and public.is_approved_structure_admin(r.structure_id);

  if not found then
    raise exception 'Referral not found or access denied';
  end if;
end;
$$;

revoke all on function public.update_referral_case(uuid, public.case_status, text) from public, anon;
grant execute on function public.update_referral_case(uuid, public.case_status, text) to authenticated;
