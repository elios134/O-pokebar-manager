create table public.echanges (
  id                       uuid primary key default gen_random_uuid(),
  demandeur_id             uuid not null references public.profiles (id) on delete cascade,
  horaire_demandeur_id     uuid not null references public.shifts (id) on delete cascade,
  destinataire_id          uuid not null references public.profiles (id) on delete cascade,
  horaire_destinataire_id  uuid references public.shifts (id) on delete cascade, -- vide = simple cession
  message                  text check (message is null or length(message) <= 300),
  statut                   text not null default 'attente_collegue'
    check (statut in ('attente_collegue', 'refuse_collegue', 'attente_admin', 'accepte', 'refuse', 'annule')),
  cree_le                  timestamptz not null default now(),
  maj_le                   timestamptz not null default now(),
  constraint echange_deux_personnes check (demandeur_id <> destinataire_id)
);

alter table public.echanges enable row level security;

-- Lecture seulement ; toutes les actions passent par les fonctions ci-dessous (qui vérifient les droits).
create policy "echanges_lecture"
  on public.echanges for select to authenticated
  using (demandeur_id = auth.uid() or destinataire_id = auth.uid() or prive.est_admin());

create or replace function prive.est_actif(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p and actif);
$$;
revoke all on function prive.est_actif(uuid) from public, anon;
grant execute on function prive.est_actif(uuid) to authenticated;

-- Collègues à qui proposer un échange (prénom + nom seulement).
create or replace function public.collegues()
returns table (id uuid, prenom text, nom text)
language sql stable security definer set search_path = public as $$
  select p.id, p.prenom, p.nom from public.profiles p
  where prive.est_actif(auth.uid()) and p.actif and p.id <> auth.uid()
  order by p.prenom, p.nom;
$$;

-- Horaires à venir d'un collègue (dates et heures seulement).
create or replace function public.horaires_collegue(p_collegue uuid)
returns table (id uuid, debut timestamptz, fin timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.debut, s.fin from public.shifts s
  where prive.est_actif(auth.uid()) and prive.est_actif(p_collegue)
    and s.employe_id = p_collegue and s.debut > now()
  order by s.debut
  limit 60;
$$;

-- Liste des échanges visibles par la personne connectée, avec les noms et les heures.
create or replace function public.mes_echanges()
returns table (
  id uuid, statut text, message text, cree_le timestamptz,
  demandeur_id uuid, demandeur text, destinataire_id uuid, destinataire text,
  debut_demandeur timestamptz, fin_demandeur timestamptz,
  debut_destinataire timestamptz, fin_destinataire timestamptz
)
language sql stable security definer set search_path = public as $$
  select e.id, e.statut, e.message, e.cree_le,
         e.demandeur_id, pd.prenom || ' ' || pd.nom,
         e.destinataire_id, pt.prenom || ' ' || pt.nom,
         sd.debut, sd.fin, st.debut, st.fin
  from public.echanges e
  join public.profiles pd on pd.id = e.demandeur_id
  join public.profiles pt on pt.id = e.destinataire_id
  join public.shifts sd on sd.id = e.horaire_demandeur_id
  left join public.shifts st on st.id = e.horaire_destinataire_id
  where prive.est_actif(auth.uid())
    and (e.demandeur_id = auth.uid() or e.destinataire_id = auth.uid() or prive.est_admin())
  order by e.cree_le desc
  limit 200;
$$;

create or replace function public.proposer_echange(
  p_horaire uuid, p_collegue uuid, p_horaire_collegue uuid default null, p_message text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nouvel_id uuid;
begin
  if not prive.est_actif(auth.uid()) then raise exception 'Compte inactif.'; end if;
  if p_collegue = auth.uid() or not prive.est_actif(p_collegue) then
    raise exception 'Collègue invalide.';
  end if;
  if not exists (select 1 from shifts where id = p_horaire and employe_id = auth.uid() and debut > now()) then
    raise exception 'Cet horaire ne vous appartient pas ou est déjà passé.';
  end if;
  if p_horaire_collegue is not null and not exists (
    select 1 from shifts where id = p_horaire_collegue and employe_id = p_collegue and debut > now()
  ) then
    raise exception 'Horaire du collègue invalide.';
  end if;
  if exists (
    select 1 from echanges
    where statut in ('attente_collegue', 'attente_admin')
      and (horaire_demandeur_id in (p_horaire, p_horaire_collegue)
           or horaire_destinataire_id in (p_horaire, p_horaire_collegue))
  ) then
    raise exception 'Un échange est déjà en cours pour cet horaire.';
  end if;
  insert into echanges (demandeur_id, horaire_demandeur_id, destinataire_id, horaire_destinataire_id, message)
  values (auth.uid(), p_horaire, p_collegue, p_horaire_collegue, nullif(trim(p_message), ''))
  returning id into nouvel_id;
  return nouvel_id;
end;
$$;

create or replace function public.repondre_echange(p_id uuid, p_accepte boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not prive.est_actif(auth.uid()) then raise exception 'Compte inactif.'; end if;
  update echanges
  set statut = case when p_accepte then 'attente_admin' else 'refuse_collegue' end, maj_le = now()
  where id = p_id and destinataire_id = auth.uid() and statut = 'attente_collegue';
  if not found then raise exception 'Échange introuvable ou déjà traité.'; end if;
end;
$$;

create or replace function public.annuler_echange(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update echanges set statut = 'annule', maj_le = now()
  where id = p_id and demandeur_id = auth.uid() and statut in ('attente_collegue', 'attente_admin');
  if not found then raise exception 'Échange introuvable ou déjà traité.'; end if;
end;
$$;

-- L'admin valide : les horaires changent vraiment de main.
create or replace function public.valider_echange(p_id uuid, p_accepte boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  e echanges%rowtype;
begin
  if not prive.est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  select * into e from echanges where id = p_id and statut = 'attente_admin' for update;
  if not found then raise exception 'Échange introuvable ou déjà traité.'; end if;

  if not p_accepte then
    update echanges set statut = 'refuse', maj_le = now() where id = p_id;
    return;
  end if;

  -- Les horaires n'ont pas changé de propriétaire entre-temps ?
  if not exists (select 1 from shifts where id = e.horaire_demandeur_id and employe_id = e.demandeur_id)
     or (e.horaire_destinataire_id is not null and not exists (
       select 1 from shifts where id = e.horaire_destinataire_id and employe_id = e.destinataire_id)) then
    raise exception 'Les horaires ont changé depuis la demande. Refusez cet échange.';
  end if;

  update shifts set employe_id = e.destinataire_id where id = e.horaire_demandeur_id;
  if e.horaire_destinataire_id is not null then
    update shifts set employe_id = e.demandeur_id where id = e.horaire_destinataire_id;
  end if;
  update echanges set statut = 'accepte', maj_le = now() where id = p_id;
end;
$$;

-- Appelables seulement par les personnes connectées (les fonctions vérifient elles-mêmes les droits).
revoke all on function public.collegues() from public, anon;
revoke all on function public.horaires_collegue(uuid) from public, anon;
revoke all on function public.mes_echanges() from public, anon;
revoke all on function public.proposer_echange(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.repondre_echange(uuid, boolean) from public, anon;
revoke all on function public.annuler_echange(uuid) from public, anon;
revoke all on function public.valider_echange(uuid, boolean) from public, anon;
grant execute on function public.collegues() to authenticated;
grant execute on function public.horaires_collegue(uuid) to authenticated;
grant execute on function public.mes_echanges() to authenticated;
grant execute on function public.proposer_echange(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.repondre_echange(uuid, boolean) to authenticated;
grant execute on function public.annuler_echange(uuid) to authenticated;
grant execute on function public.valider_echange(uuid, boolean) to authenticated;

