-- « Voir l'équipe du jour » limité : seulement aujourd'hui ou demain, et seulement si l'employé
-- travaille lui-même ce jour-là. Sinon la liste est vide.
create or replace function public.equipe_du_jour(p_jour date)
returns table (employe_id uuid, prenom text, nom text, debut timestamptz, fin timestamptz)
language sql stable security definer set search_path = public as $$
  with bornes as (
    select (p_jour::timestamp at time zone 'Europe/Paris') as de,
           ((p_jour + 1)::timestamp at time zone 'Europe/Paris') as a
  )
  select p.id, p.prenom, p.nom, s.debut, s.fin
  from bornes, public.profiles moi
  join public.profiles p on p.equipe_id = moi.equipe_id and p.actif
  join public.shifts s on s.employe_id = p.id
  where moi.id = auth.uid() and moi.actif and moi.equipe_id is not null
    and p_jour between (now() at time zone 'Europe/Paris')::date and (now() at time zone 'Europe/Paris')::date + 1
    and exists (select 1 from public.shifts m where m.employe_id = moi.id and m.debut >= bornes.de and m.debut < bornes.a)
    and s.debut >= bornes.de and s.debut < bornes.a
  order by s.debut, p.prenom, p.nom;
$$;
