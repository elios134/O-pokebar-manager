-- « Voir l'équipe du jour » : un employé voit qui de SON équipe travaille un jour donné, avec les heures.
-- Il ne voit jamais les autres équipes, ni rien s'il n'est dans aucune équipe.
create or replace function public.equipe_du_jour(p_jour date)
returns table (employe_id uuid, prenom text, nom text, debut timestamptz, fin timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.prenom, p.nom, s.debut, s.fin
  from public.profiles moi
  join public.profiles p on p.equipe_id = moi.equipe_id and p.actif
  join public.shifts s on s.employe_id = p.id
  where moi.id = auth.uid() and moi.actif and moi.equipe_id is not null
    and s.debut >= (p_jour::timestamp at time zone 'Europe/Paris')
    and s.debut < ((p_jour + 1)::timestamp at time zone 'Europe/Paris')
  order by s.debut, p.prenom, p.nom;
$$;
revoke all on function public.equipe_du_jour(date) from public, anon;
grant execute on function public.equipe_du_jour(date) to authenticated;
