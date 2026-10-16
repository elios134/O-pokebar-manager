-- La grille rapide enregistre aussi la note de chaque horaire (ex. « Inventaire »).
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
      if length(h->>'note') > 200 then
        raise exception 'Note trop longue.';
      end if;
      if i <= cardinality(anciens) then
        update public.shifts
        set debut = (h->>'debut')::timestamptz,
            fin = (h->>'fin')::timestamptz,
            pause_debut = (h->>'pause_debut')::timestamptz,
            pause_fin = (h->>'pause_fin')::timestamptz,
            note = nullif(trim(h->>'note'), '')
        where id = anciens[i];
      else
        insert into public.shifts (employe_id, debut, fin, pause_debut, pause_fin, note)
        values ((c->>'employe_id')::uuid, (h->>'debut')::timestamptz, (h->>'fin')::timestamptz,
                (h->>'pause_debut')::timestamptz, (h->>'pause_fin')::timestamptz, nullif(trim(h->>'note'), ''));
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
