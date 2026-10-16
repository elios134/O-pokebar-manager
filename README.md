# O'pokebar · Planning

Site de gestion des plannings des employés (React + TypeScript + Vite + Tailwind + Supabase + FullCalendar).

- **Employé** : voit son planning (semaine, mois, liste), ses heures de la semaine et son prochain service ;
  demande des congés et suit la réponse.
- **Admin** : planning de l'équipe sous forme de grille façon tableur (une ligne par employé, une colonne par
  jour) remplie avec des horaires types (pinceau, sélection, clavier, copie de la semaine précédente, pauses,
  coupures, services de nuit, notes), filtres par équipe et par employé, export PDF. Vue « par employé »
  sur une semaine ou un mois, avec sa semaine type à appliquer en un clic et ses heures comparées au contrat.
  Réponse aux demandes de congé, gestion des comptes et des équipes.
- **PWA** : installable sur téléphone et ordinateur (bouton discret, toujours disponible dans « Mon compte »),
  message « Nouvelle version disponible » lors des mises à jour, et dernier planning consultable sans réseau.

## Démarrer en local
1. Copier `.env.example` en `.env` et remplir l'URL et la clé publique de Supabase.
2. `npm install`
3. `npm run dev`

## Base de données et serveur
- `supabase/migrations/` : la base étape par étape (tables, règles de sécurité RLS, garde-fous,
  notifications). Un fichier daté par changement, appliqués dans l'ordre ; ne jamais modifier un fichier
  déjà appliqué, en ajouter un nouveau.
- `supabase/functions/gerer-employe` : fonction serveur (créer, désactiver, supprimer un compte, changer
  email ou mot de passe), seule à utiliser la clé secrète.

## Tests
- `npm run test:e2e` : tests dans un vrai navigateur, avec une fausse base (aucune donnée réelle touchée).
  Si Chromium n'est pas installé par Playwright : `CHROMIUM_PATH=/chemin/vers/chrome npm run test:e2e`.
- `npm run test:sql` : crée une base PostgreSQL jetable, applique les migrations et vérifie les droits
  (qui peut lire, créer, modifier, supprimer) et les automatismes. Nécessite PostgreSQL installé.

## Mise en ligne
Hébergé sur Vercel : chaque envoi sur la branche `claude/project-continuation-0q43t2` met le site à jour.
Variables à définir dans Vercel : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
