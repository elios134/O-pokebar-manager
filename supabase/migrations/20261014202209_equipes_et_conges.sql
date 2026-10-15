-- ---------- Équipes ----------
create table public.equipes (
  id      uuid primary key default gen_random_uuid(),
  nom     text not null unique check (length(trim(nom)) between 1 and 60),
  cree_le timestamptz not null default now()
);

alter table public.profiles
  add column if not exists equipe_id uuid references public.equipes (id) on delete set null;

alter table public.equipes enable row level security;

create policy "equipes_lecture"
  on public.equipes for select to authenticated using (true);
create policy "equipes_ajout_admin"
  on public.equipes for insert to authenticated with check (prive.est_admin());
create policy "equipes_modif_admin"
  on public.equipes for update to authenticated using (prive.est_admin()) with check (prive.est_admin());
create policy "equipes_suppr_admin"
  on public.equipes for delete to authenticated using (prive.est_admin());

-- ---------- Congés ----------
create table public.conges (
  id          uuid primary key default gen_random_uuid(),
  employe_id  uuid not null references public.profiles (id) on delete cascade,
  debut       date not null,
  fin         date not null,
  motif       text check (motif is null or length(motif) <= 300),
  statut      text not null default 'en_attente' check (statut in ('en_attente', 'accepte', 'refuse')),
  reponse     text check (reponse is null or length(reponse) <= 300),
  cree_le     timestamptz not null default now(),
  traite_le   timestamptz,
  traite_par  uuid references public.profiles (id) on delete set null,
  constraint conge_fin_apres_debut check (fin >= debut)
);

create index conges_employe_debut_idx on public.conges (employe_id, debut);

alter table public.conges enable row level security;

-- Lecture : l'employé (actif) voit ses demandes, l'admin voit tout.
create policy "conges_lecture"
  on public.conges for select to authenticated
  using (
    prive.est_admin()
    or (employe_id = auth.uid()
        and exists (select 1 from public.profiles where id = auth.uid() and actif))
  );

-- Demande : un employé actif crée une demande pour lui-même, toujours « en attente ».
create policy "conges_demande"
  on public.conges for insert to authenticated
  with check (
    employe_id = auth.uid()
    and statut = 'en_attente'
    and reponse is null and traite_le is null and traite_par is null
    and exists (select 1 from public.profiles where id = auth.uid() and actif)
  );

-- Annulation : l'employé retire sa demande tant qu'elle n'est pas traitée. L'admin peut tout supprimer.
create policy "conges_suppression"
  on public.conges for delete to authenticated
  using ((employe_id = auth.uid() and statut = 'en_attente') or prive.est_admin());

-- Réponse : admin seulement.
create policy "conges_reponse_admin"
  on public.conges for update to authenticated
  using (prive.est_admin()) with check (prive.est_admin());

-- Qui a répondu et quand : rempli automatiquement. La demande elle-même ne change pas d'employé.
create or replace function prive.trace_reponse_conge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut is distinct from old.statut then
    new.traite_le := case when new.statut = 'en_attente' then null else now() end;
    new.traite_par := case when new.statut = 'en_attente' then null else auth.uid() end;
  end if;
  new.employe_id := old.employe_id;
  new.cree_le := old.cree_le;
  return new;
end;
$$;

revoke all on function prive.trace_reponse_conge() from public, anon, authenticated;

create trigger avant_reponse_conge
  before update on public.conges
  for each row execute function prive.trace_reponse_conge();
