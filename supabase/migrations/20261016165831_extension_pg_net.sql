-- Appels réseau depuis la base (pg_net), utilisés pour les notifications sur téléphone.
-- (En local, pour les tests, l'extension peut manquer : on continue sans.)
do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net indisponible ici.';
end $$;
