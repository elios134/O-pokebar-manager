-- ---------- Horaires types (pinceaux de la grille rapide) ----------
-- Un horaire type = un ou deux créneaux (deux pour une coupure), chacun avec une pause facultative.
-- Heures au format "HH:MM" ; une fin avant le début veut dire le lendemain.
create table public.modeles_horaires (
  id       uuid primary key default gen_random_uuid(),
  nom      text not null check (length(trim(nom)) between 1 and 30),
  code     text not null unique check (code ~ '^[A-Z0-9]{1,2}$'),
  couleur  smallint not null default 0 check (couleur between 0 and 7),
  creneaux jsonb not null check (jsonb_typeof(creneaux) = 'array' and jsonb_array_length(creneaux) between 1 and 2),
  ordre    integer not null default 0,
  cree_le  timestamptz not null default now()
);

alter table public.modeles_horaires enable row level security;

create policy "modeles_lecture_admin" on public.modeles_horaires for select to authenticated using (prive.est_admin());
create policy "modeles_ajout_admin" on public.modeles_horaires for insert to authenticated with check (prive.est_admin());
create policy "modeles_modif_admin" on public.modeles_horaires for update to authenticated
  using (prive.est_admin()) with check (prive.est_admin());
create policy "modeles_suppr_admin" on public.modeles_horaires for delete to authenticated using (prive.est_admin());

-- Quelques horaires types pour démarrer (modifiables ou supprimables par l'admin).
insert into public.modeles_horaires (nom, code, couleur, creneaux, ordre) values
  ('Ouverture', 'O', 0, '[{"debut":"10:00","fin":"15:00"}]', 1),
  ('Midi',      'M', 1, '[{"debut":"11:30","fin":"15:30"}]', 2),
  ('Soir',      'S', 2, '[{"debut":"18:00","fin":"23:00"}]', 3),
  ('Journée',   'J', 3, '[{"debut":"10:00","fin":"18:00","pauseDebut":"14:00","pauseFin":"14:30"}]', 4),
  ('Coupure',   'C', 4, '[{"debut":"11:00","fin":"15:00"},{"debut":"18:00","fin":"22:00"}]', 5);

-- ---------- Enregistrement de la grille en une seule fois ----------
-- p_cases : [{ "employe_id", "de", "a", "horaires": [{ "debut", "fin", "pause_debut", "pause_fin" }] }]
-- Pour chaque case (un employé, un jour de « de » à « a ») : les horaires qui commencent ce jour-là
-- sont remplacés par ceux donnés (modifiés si possible, sinon ajoutés ou supprimés).
-- Tout passe ou rien ne passe. Les droits sont ceux de la personne connectée (RLS).
create or replace function public.remplir_grille(p_cases jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  c jsonb;
  h jsonb;
  anciens uuid[];
  i integer;
  n integer := 0;
begin
  if not prive.est_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_cases) is distinct from 'array' or jsonb_array_length(p_cases) > 1000 then
    raise exception 'Données invalides.';
  end if;

  for c in select value from jsonb_array_elements(p_cases) loop
    if (c->>'a')::timestamptz <= (c->>'de')::timestamptz
       or (c->>'a')::timestamptz - (c->>'de')::timestamptz > interval '26 hours' then
      raise exception 'Jour invalide.';
    end if;

    select coalesce(array_agg(id order by debut), '{}') into anciens
    from public.shifts
    where employe_id = (c->>'employe_id')::uuid
      and debut >= (c->>'de')::timestamptz
      and debut < (c->>'a')::timestamptz;

    i := 0;
    for h in select value from jsonb_array_elements(coalesce(c->'horaires', '[]'::jsonb)) loop
      i := i + 1;
      if i <= cardinality(anciens) then
        update public.shifts
        set debut = (h->>'debut')::timestamptz,
            fin = (h->>'fin')::timestamptz,
            pause_debut = (h->>'pause_debut')::timestamptz,
            pause_fin = (h->>'pause_fin')::timestamptz
        where id = anciens[i];
      else
        insert into public.shifts (employe_id, debut, fin, pause_debut, pause_fin)
        values ((c->>'employe_id')::uuid, (h->>'debut')::timestamptz, (h->>'fin')::timestamptz,
                (h->>'pause_debut')::timestamptz, (h->>'pause_fin')::timestamptz);
      end if;
      n := n + 1;
    end loop;

    if cardinality(anciens) > i then
      delete from public.shifts where id = any (anciens[i + 1:]);
    end if;
  end loop;

  return n;
end;
$$;

revoke all on function public.remplir_grille(jsonb) from public, anon;
grant execute on function public.remplir_grille(jsonb) to authenticated;
