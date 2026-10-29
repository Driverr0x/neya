-- Note rédigée par l'IA pour le soignant, relue par l'utilisatrice avant son accord.
-- Facultative : si l'IA ne répond pas, le résumé part avec les seules données de l'évaluation.
alter table public.referrals
  add column ai_summary text,
  add constraint referral_ai_summary_length check (ai_summary is null or char_length(ai_summary) <= 2000);
