-- Checklists d'ouverture / fermeture : l'admin crée les listes et leurs tâches ; chaque jour, les
-- employés cochent. Une liste peut être réservée à la cuisine et limitée à certains jours.

create table public.checklists (
  id                uuid primary key default gen_random_uuid(),
  nom               text not null unique check (length(trim(nom)) between 1 and 40),
  cuisine_seulement boolean not null default false,
  jours             smallint[] not null default '{1,2,3,4,5,6,7}' -- 1 = lundi … 7 = dimanche
    check (jours <@ '{1,2,3,4,5,6,7}'::smallint[]),
  ordre             integer not null default 0,
  cree_le           timestamptz not null default now()
);

create table public.checklist_taches (
  id           uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists (id) on delete cascade,
  texte        text not null check (length(trim(texte)) between 1 and 120),
  ordre        integer not null default 0,
  active       boolean not null default true, -- retirée : garde son historique
  cree_le      timestamptz not null default now()
);
create index checklist_taches_liste_idx on public.checklist_taches (checklist_id, ordre);

create table public.checklist_coches (
  id        uuid primary key default gen_random_uuid(),
  tache_id  uuid not null references public.checklist_taches (id) on delete cascade,
  jour      date not null default (now() at time zone 'Europe/Paris')::date,
  coche_par uuid references public.profiles (id) on delete set null default auth.uid(),
  coche_le  timestamptz not null default now(),
  unique (tache_id, jour)
);
create index checklist_coches_jour_idx on public.checklist_coches (jour);

-- Le compte connecté peut-il voir (et cocher) cette liste ?
create or replace function prive.voit_checklist(p_checklist uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select prive.moi_actif() and exists (
    select 1 from public.checklists c where c.id = p_checklist and (not c.cuisine_seulement or prive.est_cuisine()));
$$;
create or replace function prive.voit_tache(p_tache uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select prive.voit_checklist((select checklist_id from public.checklist_taches where id = p_tache));
$$;
revoke all on function prive.voit_checklist(uuid) from public, anon;
revoke all on function prive.voit_tache(uuid) from public, anon;
grant execute on function prive.voit_checklist(uuid) to authenticated;
grant execute on function prive.voit_tache(uuid) to authenticated;

alter table public.checklists enable row level security;
create policy "checklists_lecture" on public.checklists for select to authenticated using (prive.voit_checklist(id));
create policy "checklists_ajout_admin" on public.checklists for insert to authenticated with check (prive.est_admin());
create policy "checklists_modif_admin" on public.checklists for update to authenticated using (prive.est_admin()) with check (prive.est_admin());
create policy "checklists_suppr_admin" on public.checklists for delete to authenticated using (prive.est_admin());

alter table public.checklist_taches enable row level security;
create policy "taches_lecture" on public.checklist_taches for select to authenticated using (prive.voit_checklist(checklist_id));
create policy "taches_ajout_admin" on public.checklist_taches for insert to authenticated with check (prive.est_admin());
create policy "taches_modif_admin" on public.checklist_taches for update to authenticated using (prive.est_admin()) with check (prive.est_admin());
create policy "taches_suppr_admin" on public.checklist_taches for delete to authenticated using (prive.est_admin());

alter table public.checklist_coches enable row level security;
create policy "coches_lecture" on public.checklist_coches for select to authenticated using (prive.voit_tache(tache_id));
create policy "coches_ajout" on public.checklist_coches for insert to authenticated with check (prive.voit_tache(tache_id));
-- Décocher : le jour même, sa propre coche (l'admin : toutes).
create policy "coches_retrait" on public.checklist_coches for delete to authenticated
  using (prive.est_admin() or (coche_par = auth.uid() and jour = (now() at time zone 'Europe/Paris')::date));

-- On coche toujours pour aujourd'hui, en son nom.
create or replace function prive.trace_coche()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.jour := (now() at time zone 'Europe/Paris')::date;
  new.coche_par := coalesce(auth.uid(), new.coche_par);
  new.coche_le := now();
  return new;
end;
$$;
revoke all on function prive.trace_coche() from public, anon, authenticated;
create trigger avant_coche before insert on public.checklist_coches
  for each row execute function prive.trace_coche();

-- Noms de ceux qui ont coché (un employé ne lit que son propre profil).
create or replace function public.noms_equipe()
returns table (id uuid, prenom text, nom text)
language sql stable security definer set search_path = public as $$
  select p.id, p.prenom, p.nom from public.profiles p where prive.moi_actif();
$$;
revoke all on function public.noms_equipe() from public, anon;
grant execute on function public.noms_equipe() to authenticated;
