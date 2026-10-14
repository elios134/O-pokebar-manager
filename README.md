# O'pokebar · Planning

Site de gestion des plannings des employés (React + TypeScript + Vite + Tailwind + Supabase + FullCalendar).

- **Employé** : voit son planning (semaine, mois, liste), ses heures de la semaine et son prochain service ;
  demande des congés et suit la réponse.
- **Admin** : planning de toute l'équipe (filtre par équipe et par employé, ajout / modification / suppression
  d'un horaire, glisser-déposer, planification de plusieurs jours d'un coup, pauses placées), réponse aux
  demandes de congé, gestion des comptes et des équipes.
- **PWA** : installable sur téléphone et ordinateur.

## Démarrer en local
1. Copier `.env.example` en `.env` et remplir l'URL et la clé publique de Supabase.
2. `npm install`
3. `npm run dev`

## Base de données et serveur
- `supabase/schema.sql` : tables, règles de sécurité (RLS) et garde-fous.
- `supabase/functions/gerer-employe` : fonction serveur (création et désactivation des comptes),
  seule à utiliser la clé secrète.

## Mise en ligne
Hébergé sur Vercel : chaque envoi sur la branche principale met le site à jour.
Variables à définir dans Vercel : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
