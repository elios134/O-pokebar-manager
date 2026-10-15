alter table public.shifts
  add column if not exists pause_debut timestamptz,
  add column if not exists pause_fin timestamptz;

-- Pauses déjà saisies en durée seule : placées au milieu du service.
update public.shifts
set pause_debut = debut + ((fin - debut) - make_interval(mins => pause_minutes)) / 2,
    pause_fin   = debut + ((fin - debut) + make_interval(mins => pause_minutes)) / 2
where pause_minutes > 0 and pause_debut is null;

alter table public.shifts
  add constraint pause_dans_le_service check (
    (pause_debut is null) = (pause_fin is null)
    and (pause_debut is null
         or (pause_debut >= debut and pause_fin <= fin and pause_fin > pause_debut))
  );

-- La durée de pause est toujours calculée à partir des heures de pause.
create or replace function prive.calculer_pause()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.pause_debut is not null and new.pause_fin is not null then
    new.pause_minutes := round(extract(epoch from (new.pause_fin - new.pause_debut)) / 60);
  else
    new.pause_minutes := 0;
  end if;
  return new;
end;
$$;
revoke all on function prive.calculer_pause() from public, anon, authenticated;

create trigger calcul_pause
  before insert or update on public.shifts
  for each row execute function prive.calculer_pause();
