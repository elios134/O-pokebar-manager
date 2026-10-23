-- Rappels quotidiens de la cuisine (heures en UTC : 7 h ≈ 8 h-9 h à Paris, 13 h ≈ 14 h-15 h).
-- (En local, pour les tests, pg_cron peut manquer : on continue sans.)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('cuisine-rappel-dlc', '0 7 * * *', 'select prive.rappel_dlc()');
  perform cron.schedule('cuisine-rappel-temperatures', '0 13 * * *', 'select prive.rappel_temperatures()');
exception when others then
  raise notice 'pg_cron indisponible ici : pas de rappels automatiques.';
end $$;
