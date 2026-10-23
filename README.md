# O'pokebar · Planning

Site de gestion des plannings des employés (React + TypeScript + Vite + Tailwind + Supabase + FullCalendar).

- **Employé** : voit son planning (semaine, mois, liste), ses heures de la semaine et son prochain service ;
  demande des congés et des acomptes sur salaire, et suit la réponse.
- **Cuisine** : tout ce que fait un employé, plus l'espace « Cuisine » : DLC des produits ouverts (photo
  de l'étiquette, rappel la veille et le jour même), relevé quotidien de la température des frigos
  (responsable prévenu si hors limites, rappel à 15 h si oublié) et liste des produits à commander.
- **Admin** : planning de l'équipe sous forme de grille façon tableur (une ligne par employé, une colonne par
  jour) remplie avec des horaires types (pinceau, sélection, clavier, copie de la semaine précédente, pauses,
  coupures, services de nuit, notes), filtres par équipe et par employé, export PDF. Vue « par employé »
  sur une semaine ou un mois, avec sa semaine type à appliquer en un clic et ses heures comparées au contrat.
  Réponse aux demandes de congé et d'acompte, gestion des comptes et des équipes. Accès à l'espace
  « Cuisine » : création des frigos et de leurs limites, suivi des commandes (« Commandé » puis « Reçu »).
- **PWA** : installable sur téléphone et ordinateur (bouton discret, toujours disponible dans « Mon compte »),
  message « Nouvelle version disponible » lors des mises à jour, dernier planning consultable sans réseau,
  et notifications sur le téléphone (à activer dans « Mon compte » ; sur iPhone, après ajout à l'écran d'accueil).

## Démarrer en local
1. Copier `.env.example` en `.env` et remplir l'URL et la clé publique de Supabase.
2. `npm install`
3. `npm run dev`

## Base de données et serveur
- `supabase/migrations/` : la base étape par étape (tables, règles de sécurité RLS, garde-fous,
  notifications). Un fichier daté par changement, appliqués dans l'ordre ; ne jamais modifier un fichier
  déjà appliqué, en ajouter un nouveau.
- `supabase/functions/envoyer-push` : envoie les notifications sur les téléphones (appelée par la base).
  Ses clés sont dans le coffre de Supabase (Vault : `push_url`, `push_cle`, `push_vapid_publique`,
  `push_vapid_privee`), jamais dans le code.
- Photos des DLC : stockage privé `dlc` (5 Mo maximum, images), lisible seulement par la cuisine et l'admin.
- Rappels automatiques (pg_cron) : `cuisine-rappel-dlc` à 7 h UTC et `cuisine-rappel-temperatures` à 13 h UTC.
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
