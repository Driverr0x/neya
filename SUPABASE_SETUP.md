# Configuration du backend NEYA (MVP)

NEYA utilise Supabase pour l’authentification, les données, les fichiers et les messages en temps réel. Le navigateur ne reçoit que l’URL Supabase et la clé publique `anon`. **Ne placez jamais la clé `service_role` ni la clé du fournisseur IA dans l’application.**

## 1. Créer et configurer le projet

1. Créez un projet Supabase et conservez son URL, sa clé publique `anon` et sa référence de projet.
2. Dans **Authentication → Sign In / Providers**, activez l’authentification anonyme ainsi que l’authentification par e-mail/mot de passe.
3. Configurez les URL de redirection d’authentification pour les domaines web et mobiles utilisés par l’application. Dans **Authentication → URL Configuration** :
   - **Site URL** : l’adresse de l’application (en développement `http://localhost:8100`) ;
   - **Redirect URLs** : ajoutez `http://localhost:8100/professional-access`, et l’équivalent pour chaque domaine de démonstration ou de production.

   Le lien de confirmation d’e-mail d’une structure ou d’un médecin ramène sur `/professional-access`, qui termine l’inscription automatiquement : les informations saisies sont conservées dans le compte (`user_metadata.neya_registration`) puis effacées une fois l’inscription aboutie.
4. Dans **Project Settings → API**, copiez l’URL du projet et la clé publique `anon` dans :
   - `src/environments/environment.ts`
   - `src/environments/environment.prod.ts`

```ts
export const environment = {
  production: false,
  supabaseUrl: 'https://<project-ref>.supabase.co',
  supabaseAnonKey: '<public-anon-key>',
};
```

La clé `anon` est une clé publique. La protection des données dépend des politiques RLS de la migration, pas du secret de cette clé.

## 2. Appliquer le schéma

Installez la CLI Supabase si nécessaire, connectez-la au projet, puis poussez la migration :

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

La migration `supabase/migrations/202610260001_initial_platform.sql` crée les profils, structures, invitations, dépistages, rendez-vous, vidéos, conversations et messages. Les politiques RLS limitent les données de chaque structure et de chaque conversation à leurs participants.

## 3. Déployer les fonctions backend

Déployez les fonctions avec vérification JWT activée :

```powershell
npx supabase functions deploy register-structure
npx supabase functions deploy register-doctor
npx supabase functions deploy create-doctor-invite
npx supabase functions deploy explain-result
npx supabase functions deploy visitor-recovery
```

Configurez les secrets dans **Project Settings → Edge Functions → Secrets** :

- `GEMINI_API_KEY` : facultative; sans elle, l’explication locale reste disponible et l’endpoint IA renvoie une erreur explicite.
- `GEMINI_MODEL` : facultative; valeur par défaut `gemini-3.1-flash-lite` (rapide ; « réflexion » réduite au minimum).

Les clés `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournies par l’environnement Supabase aux Edge Functions. N’ajoutez pas la clé `service_role` aux fichiers du projet.

## 4. Parcours et endpoints

- Les visiteurs n’ont pas de formulaire d’inscription. L’application crée une session Supabase anonyme au premier usage qui nécessite un enregistrement; elle permet de relier leurs rendez-vous, inscriptions et conversations à cette session.
- `POST /functions/v1/register-structure` convertit le compte e-mail authentifié en compte structure en attente de vérification.
- Un administrateur de structure vérifiée peut créer une invitation via `POST /functions/v1/create-doctor-invite`. Le code est à usage unique et expire après sept jours.
- `POST /functions/v1/register-doctor` associe le profil médecin à une structure à l’aide du code d’invitation.
- Les profils médecins, vidéos publiées et dépistages sont lus via les API de tables Supabase. Les rendez-vous utilisent `bookings`; les messages texte/audio utilisent `conversations`, `messages` et le bucket privé `neya-audio`. La souscription Realtime diffuse les nouveaux messages aux participants.
- Les vidéos sont stockées dans le bucket privé `neya-videos`; l’application n’obtient que des URL signées. Les médecins publient une vidéo depuis leur espace; les structures vérifiées consultent les vidéos et leurs demandes de rendez-vous/dépistage.
- `POST /functions/v1/explain-result` reformule le résultat seulement après consentement explicite. Le fournisseur IA ne reçoit ni nom, ni téléphone, ni adresse e-mail. L’orientation médicale reste déterminée par les règles NEYA et n’est pas modifiée par l’IA. La fonction limite les demandes à cinq par minute et par session.

## 5. Vérifier une structure

Les nouvelles structures restent volontairement non vérifiées. L’équipe NEYA les valide depuis l’application, sur l’écran **Équipe NEYA** (`/neya-admin`) : demandes en attente, validées et refusées, avec les boutons « Valider », « Refuser » et « Retirer la validation ».

Un membre de l’équipe est un compte ordinaire, ni structure ni médecin, créé dans Supabase (**Authentication → Users → Add user → Create new user**, case « Auto Confirm User » cochée), puis ajouté dans la table `platform_admins`. Cet ajout se fait uniquement dans **SQL Editor**, jamais depuis l’application :

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'membre@exemple.org';
```

Une fois ajouté, ce compte se connecte sur `/professional-access` (onglet « Connexion ») et arrive directement sur l’écran Équipe NEYA. Ne donnez pas l’accès SQL aux comptes de structure.

## 6. Vérifier les médecins (numéro d’ordre)

Un médecin s’inscrit avec le code d’invitation de sa structure **et son numéro d’ordre**. Son compte reste « en attente » : il n’apparaît pas aux utilisatrices et sa messagerie est fermée. Sur l’écran **Équipe NEYA**, onglet **Médecins**, vérifiez le numéro auprès de l’Ordre concerné puis touchez « Numéro vérifié ». « Suspendre » le retire de l’application.

## 7. Résumés envoyés aux structures et suivi des cas

Après une évaluation de niveau 2 ou 3, l’utilisatrice peut envoyer un résumé (résultat, âge, changements signalés, langue, ville, nom et téléphone) à une structure validée. L’envoi exige son accord exprès (case à cocher, horodaté dans `referrals.consent_at`). Seule la structure destinataire lit le résumé ; elle tient le suivi du cas (reçu → patiente contactée → cas suspect → confirmé ou écarté) avec une note interne, via la fonction `update_referral_case`.

## 8. Service IA

La fonction `explain-result` utilise Google Gemini. Créez une clé API dans Google AI Studio (aistudio.google.com → Get API key), puis ajoutez-la comme secret `GEMINI_API_KEY` (Edge Functions → Secrets). Elle sert à trois usages, en ligne seulement (hors ligne, l’application fonctionne sans IA) :

- `mode: "explain"` : reformule le résultat de l’évaluation en langage simple ;
- `mode: "question"` : répond aux questions libres de l’utilisatrice après son évaluation (2 à 5 phrases, jamais de diagnostic ni de traitement, urgences orientées vers les soins). Les questions ne sont enregistrées ni par NEYA ni par l’hôpital ; 10 questions au maximum par évaluation ;
- `mode: "summary"` : rédige une note pour le soignant, montrée à l’utilisatrice avant son accord et jointe au résumé (`referrals.ai_summary`). Si l’IA ne répond pas, le résumé part sans cette note.

L’IA ne reçoit jamais le nom ni le téléphone. Cinq demandes par minute et par session au maximum. En cas de problème, la réponse indique le motif (`AI provider rejected the API key`, `AI provider quota exceeded or rate limited`, `AI provider model not found`, `AI provider took too long to respond`).

## 9. Code de récupération des utilisatrices

Les utilisatrices n’ont pas de compte : leurs données sont liées à une session anonyme gardée sur le téléphone. Sur l’écran **Récupération** (`/tabs/recuperation`, lien en bas de l’onglet Pros et dans la conversation), elles créent un code `NEYA-XXXX-XXXX-XXXX-XXXX`. Sur un nouveau téléphone, ce code transfère conversations, rendez-vous, inscriptions et résumés vers la nouvelle session (fonction `visitor-recovery`, migration `202610290005_visitor_recovery.sql`).

- Seule l’empreinte SHA-256 du code est enregistrée ; un code ne sert qu’une fois et un nouveau est remis après usage.
- Créer un nouveau code annule l’ancien. Cinq essais par quart d’heure au maximum.
- L’ancienne session anonyme est supprimée après le transfert. Les réponses au questionnaire, gardées sur le téléphone, ne sont pas transférées.

## Limites avant toute utilisation réelle

Cette intégration constitue un MVP et n’est pas une certification de conformité. Les rendez-vous et conversations contiennent des données personnelles et potentiellement de santé. Avant d’utiliser des données réelles, faites valider les obligations de protection des données et d’hébergement applicables, la durée de conservation, la procédure de suppression, la vérification des structures/médecins et le contrat du fournisseur IA. Utilisez uniquement des comptes et dossiers fictifs pendant les essais.
