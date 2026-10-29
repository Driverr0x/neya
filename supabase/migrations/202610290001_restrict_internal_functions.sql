-- Les fonctions internes ne doivent pas être appelables depuis l'API publique (/rest/v1/rpc).
-- Signalé par `supabase db advisors` (lints 0028 et 0029).

-- Fonctions de trigger : appelées uniquement par la base, jamais par un client.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.prevent_profile_privilege_changes() from public, anon, authenticated;

-- Utilisées par les règles d'accès des comptes connectés : inutiles pour les visiteurs non connectés.
revoke all on function public.is_active_doctor() from public, anon;
revoke all on function public.is_approved_structure_admin(uuid) from public, anon;
grant execute on function public.is_active_doctor() to authenticated;
grant execute on function public.is_approved_structure_admin(uuid) to authenticated;

-- Réservée aux structures vérifiées (contrôle fait dans la fonction) : pas aux visiteurs non connectés.
revoke all on function public.update_booking_status(uuid, text) from public, anon;
grant execute on function public.update_booking_status(uuid, text) to authenticated;
