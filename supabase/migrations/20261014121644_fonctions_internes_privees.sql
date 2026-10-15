-- Schéma non exposé par l'API : les fonctions internes n'y sont plus appelables via /rpc.
create schema if not exists prive;
revoke all on schema prive from public, anon;
grant usage on schema prive to authenticated;

alter function public.est_admin() set schema prive;
alter function public.creer_profil() set schema prive;

revoke all on function prive.est_admin() from public, anon;
grant execute on function prive.est_admin() to authenticated;

-- La fonction du trigger n'a besoin d'être appelée par personne directement.
revoke all on function prive.creer_profil() from public, anon, authenticated;
