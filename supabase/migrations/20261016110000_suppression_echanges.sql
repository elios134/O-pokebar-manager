-- Échanges d'horaires abandonnés : on retire la table et tout ce qui allait avec (la table était vide).
drop function if exists public.collegues();
drop function if exists public.horaires_collegue(uuid);
drop function if exists public.mes_echanges();
drop function if exists public.proposer_echange(uuid, uuid, uuid, text);
drop function if exists public.repondre_echange(uuid, boolean);
drop function if exists public.annuler_echange(uuid);
drop function if exists public.valider_echange(uuid, boolean);
drop table if exists public.echanges;
drop function if exists prive.notif_echanges();
drop function if exists prive.est_actif(uuid);
