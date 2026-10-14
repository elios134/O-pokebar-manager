-- =====================================================================
-- Planning employés — tables + sécurité (RLS)
-- À coller dans Supabase > SQL Editor, puis "Run".
-- =====================================================================

-- ---------- Table profiles ----------
create table public.profiles (
  id      uuid primary key references auth.users (id) on delete cascade,
  nom     text not null default '',
  prenom  text not null default '',
  role    text not null default 'employe' check (role in ('employe', 'admin')),
  actif   boolean not null default true,
  email   text not null default ''  -- copie de auth.users.email, pour l'affichage
);

-- ---------- Table shifts (horaires) ----------
create table public.shifts (
  id          uuid primary key default gen_random_uuid(),
  employe_id  uuid not null references public.profiles (id) on delete cascade,
  debut       timestamptz not null,
  fin         timestamptz not null,
  note        text,
  cree_le     timestamptz not null default now(),
  pause_minutes integer not null default 0,  -- durée de pause, calculée par le trigger calcul_pause
  pause_debut timestamptz,                   -- pause placée dans le service (facultative)
  pause_fin   timestamptz,
  constraint fin_apres_debut check (fin > debut),
  constraint pause_valide check (
    pause_minutes >= 0
    and pause_minutes * 60 < extract(epoch from (fin - debut))
  ),
  constraint pause_dans_le_service check (
    (pause_debut is null) = (pause_fin is null)
    and (pause_debut is null
         or (pause_debut >= debut and pause_fin <= fin and pause_fin > pause_debut))
  )
);

create index shifts_employe_debut_idx on public.shifts (employe_id, debut);

-- ---------- Schéma privé (non exposé par l'API) pour les fonctions internes ----------
create schema if not exists prive;
revoke all on schema prive from public, anon;
grant usage on schema prive to authenticated;

-- ---------- Fonction : l'utilisateur connecté est-il un admin actif ? ----------
-- "security definer" : lit profiles sans passer par le RLS (évite une boucle).
create or replace function prive.est_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and actif
  );
$$;

revoke all on function prive.est_admin() from public, anon;
grant execute on function prive.est_admin() to authenticated;

-- ---------- La durée de pause est toujours calculée à partir des heures de pause ----------
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

-- ---------- Création automatique du profil à l'inscription ----------
-- Le rôle est TOUJOURS 'employe' au départ, quoi que le client envoie.
create or replace function prive.creer_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nom, prenom, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nom', ''),
    coalesce(new.raw_user_meta_data ->> 'prenom', ''),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

revoke all on function prive.creer_profil() from public, anon, authenticated;

create trigger a_la_creation_utilisateur
  after insert on auth.users
  for each row execute function prive.creer_profil();

-- ---------- Garde-fous sur les modifications faites depuis le site ----------
create or replace function prive.controle_modif_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    -- L'email suit le compte de connexion : on ne le change pas ici.
    new.email := old.email;
    new.id := old.id;
    -- Un admin ne peut pas se retirer ses propres droits ni se désactiver.
    if new.id = auth.uid() and (new.role <> old.role or new.actif <> old.actif) then
      raise exception 'Vous ne pouvez pas modifier votre propre rôle ou statut.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function prive.controle_modif_profil() from public, anon, authenticated;

create trigger avant_modif_profil
  before update on public.profiles
  for each row execute function prive.controle_modif_profil();

-- ---------- RLS : profiles ----------
alter table public.profiles enable row level security;

-- Lecture : chacun sa ligne, l'admin toutes.
create policy "profiles_lecture"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or prive.est_admin());

-- Modification : admin seulement (l'employé ne peut rien modifier, donc pas son rôle).
create policy "profiles_modif_admin"
  on public.profiles for update
  to authenticated
  using (prive.est_admin())
  with check (prive.est_admin());

-- Pas de policy insert/delete : seuls le trigger et le serveur (clé service) peuvent.

-- ---------- RLS : shifts ----------
alter table public.shifts enable row level security;

-- Un compte désactivé ne voit plus ses horaires, même avec une session encore ouverte.
create policy "shifts_lecture"
  on public.shifts for select
  to authenticated
  using (
    prive.est_admin()
    or (employe_id = auth.uid()
        and exists (select 1 from public.profiles where id = auth.uid() and actif))
  );

create policy "shifts_ajout_admin"
  on public.shifts for insert
  to authenticated
  with check (prive.est_admin());

create policy "shifts_modif_admin"
  on public.shifts for update
  to authenticated
  using (prive.est_admin())
  with check (prive.est_admin());

create policy "shifts_suppr_admin"
  on public.shifts for delete
  to authenticated
  using (prive.est_admin());

-- ---------- Premier admin ----------
-- Après avoir créé votre propre compte (Authentication > Users > Add user),
-- remplacez l'email ci-dessous et exécutez cette ligne une seule fois :
-- update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'vous@exemple.com');

-- =====================================================================
-- Équipes
-- =====================================================================
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

-- =====================================================================
-- Congés : l'employé demande, l'admin accepte ou refuse
-- =====================================================================
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
