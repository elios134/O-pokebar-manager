-- Compteur de congés, calculé tout seul :
--   acquis      = 2,5 jours par mois depuis la date de départ (ajoutés le 1er de chaque mois)
--   pris        = jours ouvrables (lundi au samedi) des congés acceptés, à partir de la date de départ
--   corrections = ajouts ou retraits de l'admin, avec un motif (solde de départ, maladie…)
--   restant     = acquis − pris + corrections

-- Date de départ du compteur (par défaut : le jour de création du compte, ou aujourd'hui pour les
-- comptes existants ; l'admin la change). Seul l'admin modifie les profils.
alter table public.profiles add column if not exists conges_depuis date not null default (now() at time zone 'Europe/Paris')::date;

create table public.conges_corrections (
  id         uuid primary key default gen_random_uuid(),
  employe_id uuid not null references public.profiles (id) on delete cascade,
  jours      numeric(5, 2) not null check (jours between -100 and 100 and jours <> 0),
  motif      text not null check (length(trim(motif)) between 1 and 200),
  le         date not null default (now() at time zone 'Europe/Paris')::date,
  cree_par   uuid references public.profiles (id) on delete set null default auth.uid(),
  cree_le    timestamptz not null default now()
);
create index conges_corrections_employe_idx on public.conges_corrections (employe_id, le);

alter table public.conges_corrections enable row level security;
create policy "corrections_lecture" on public.conges_corrections for select to authenticated
  using (prive.est_admin() or (employe_id = auth.uid() and prive.moi_actif()));
create policy "corrections_ajout_admin" on public.conges_corrections for insert to authenticated
  with check (prive.est_admin());
create policy "corrections_suppr_admin" on public.conges_corrections for delete to authenticated
  using (prive.est_admin());

create or replace function prive.trace_correction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.cree_par := coalesce(auth.uid(), new.cree_par);
  new.cree_le := now();
  return new;
end;
$$;
revoke all on function prive.trace_correction() from public, anon, authenticated;
create trigger avant_correction before insert on public.conges_corrections
  for each row execute function prive.trace_correction();

create or replace function prive.notif_correction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform prive.notifier(new.employe_id, 'Solde de congés corrigé',
    case when new.jours > 0 then '+' else '' end || replace(trim(to_char(new.jours, 'FM990.99')), '.', ',') || ' j · ' || new.motif,
    '/mes-conges');
  return null;
end;
$$;
revoke all on function prive.notif_correction() from public, anon, authenticated;
create trigger notif_correction after insert on public.conges_corrections
  for each row execute function prive.notif_correction();

-- Jours ouvrables (lundi au samedi) entre deux dates incluses.
create or replace function prive.jours_ouvrables(p_debut date, p_fin date)
returns integer language sql immutable as $$
  select count(*)::integer from generate_series(p_debut, p_fin, interval '1 day') d where extract(isodow from d) <> 7;
$$;

-- Soldes : l'admin voit ceux de tous les comptes, un employé seulement le sien.
create or replace function public.soldes_conges()
returns table (employe_id uuid, depuis date, acquis numeric, pris numeric, corrections numeric, restant numeric)
language sql stable security definer set search_path = public as $$
  with base as (
    select p.id, p.conges_depuis as depuis
    from public.profiles p
    where prive.est_admin() or (p.id = auth.uid() and p.actif)
  ), calc as (
    select b.id, b.depuis,
      2.5 * greatest(0,
        (extract(year from now() at time zone 'Europe/Paris') * 12 + extract(month from now() at time zone 'Europe/Paris'))
        - (extract(year from b.depuis) * 12 + extract(month from b.depuis)))::numeric as acquis,
      coalesce((select sum(prive.jours_ouvrables(greatest(c.debut, b.depuis), c.fin)) from public.conges c
        where c.employe_id = b.id and c.statut = 'accepte' and c.fin >= b.depuis), 0)::numeric as pris,
      coalesce((select sum(x.jours) from public.conges_corrections x where x.employe_id = b.id), 0)::numeric as corrections
    from base b
  )
  select id, depuis, acquis, pris, corrections, acquis - pris + corrections from calc;
$$;
revoke all on function public.soldes_conges() from public, anon;
grant execute on function public.soldes_conges() to authenticated;
