-- Fonction de calcul sans dépendance au search_path (conseil de sécurité Supabase).
alter function prive.jours_ouvrables(date, date) set search_path = '';
