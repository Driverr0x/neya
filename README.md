# NEYA

NEYA est une application mobile web / hybrid développée avec Angular + Ionic, intégrée à Supabase pour l'authentification, les données, les fichiers, les conversations temps réel et les fonctions backend.

Le projet met en place une plateforme de prise de rendez-vous, de gestion de structures, de médecins, de dépistages, de vidéos et de messagerie sécurisée.

## Stack technique

- Angular 22
- Ionic / Capacitor
- TypeScript
- Supabase JS
- RxJS
- Edge Functions Supabase

## Fonctionnalités principales

- inscription et authentification des structures et médecins
- invitations uniques pour les médecins
- gestion des profils, rendez-vous et dépistages
- stockage de vidéos dans Supabase Storage
- conversations et messages texte/audio
- diffusion temps réel via Supabase Realtime
- explication de résultats avec consentement explicite et validation IA

## Prérequis

- Node.js 18+
- npm
- un projet Supabase configuré

## Installation

```bash
npm install
```

## Configuration de l'environnement

Renseignez votre URL Supabase et votre clé publique `anon` dans les fichiers d'environnement :

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Exemple :

```ts
export const environment = {
  production: false,
  supabaseUrl: 'https://<project-ref>.supabase.co',
  supabaseAnonKey: '<public-anon-key>',
};
```

Important :
- utilisez uniquement la clé publique `anon`
- ne jamais exposer la `service_role` ou une clé fournisseur IA dans l'application

## Démarrage du projet

Pour lancer l'application en mode développement :

```bash
npm start
```

L'application s'ouvre généralement sur le port de développement Angular par défaut.

## Base de données et backend

Le schéma et la configuration backend sont documentés dans :

- `SUPABASE_SETUP.md`

Cette documentation couvre :
- création du projet Supabase
- activation de l'authentification
- application des migrations
- déploiement des Edge Functions
- variables d'environnement et bonnes pratiques de sécurité

## Structure du projet

```text
.
├── src/
│   ├── app/
│   ├── assets/
│   ├── environments/
│   └── global.scss
├── supabase/
│   ├── config.toml
│   ├── functions/
│   └── migrations/
├── angular.json
├── package.json
├── SUPABASE_SETUP.md
└── README.md
```

## Déploiement / fonctions Supabase

Pour déployer les fonctions backend :

```bash
npx supabase functions deploy register-structure
npx supabase functions deploy register-doctor
npx supabase functions deploy create-doctor-invite
npx supabase functions deploy explain-result
```

## Bonnes pratiques

- garder les secrets côté backend uniquement
- limiter les accès avec les politiques RLS Supabase
- ne pas stocker de données sensibles dans le front sans justification
- tester d'abord avec des données fictives

## Documentation supplémentaire

Pour la configuration backend complète, la sécurité et la logique métier, consultez :

- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
