# Configuration du backend NEYA (MVP)

NEYA utilise Supabase pour l’authentification, les données, les fichiers et les messages en temps réel. Le navigateur ne reçoit que l’URL Supabase et la clé publique `anon`. **Ne placez jamais la clé `service_role` ni la clé du fournisseur IA dans l’application.**

## 1. Créer et configurer le projet

1. Créez un projet Supabase et conservez son URL, sa clé publique `anon` et sa référence de projet.
2. Dans **Authentication → Sign In / Providers**, activez l’authentification anonyme ainsi que l’authentification par e-mail/mot de passe.
3. Configurez les URL de redirection d’authentification pour les domaines web et mobiles utilisés par l’application.
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
```

Configurez les secrets dans **Project Settings → Edge Functions → Secrets** :

- `OPENAI_API_KEY` : facultative; sans elle, l’explication locale reste disponible et l’endpoint IA renvoie une erreur explicite.
- `OPENAI_MODEL` : facultative; valeur par défaut `gpt-4o-mini`.

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

Les nouvelles structures restent volontairement non vérifiées. Après vérification de la structure hors application, un administrateur de confiance peut approuver son identifiant dans **SQL Editor** :

```sql
update public.structures
set approval_status = 'approved'
where id = '<structure-uuid>'
  and approval_status = 'pending';
```

Ne donnez pas l’accès SQL aux comptes de structure. L’approbation n’est pas automatisée dans ce MVP.

## Limites avant toute utilisation réelle

Cette intégration constitue un MVP et n’est pas une certification de conformité. Les rendez-vous et conversations contiennent des données personnelles et potentiellement de santé. Avant d’utiliser des données réelles, faites valider les obligations de protection des données et d’hébergement applicables, la durée de conservation, la procédure de suppression, la vérification des structures/médecins et le contrat du fournisseur IA. Utilisez uniquement des comptes et dossiers fictifs pendant les essais.
