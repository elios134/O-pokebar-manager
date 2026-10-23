-- Espace Cuisine : rôle « cuisine » (un employé avec en plus les DLC, les températures des frigos
-- et la liste des produits à commander). L'admin voit et remplit tout.

-- ---------- Rôle ----------
-- (le rôle « cuisine » est autorisé dans la migration suivante)
create or replace function prive.est_cuisine()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and actif and role in ('cuisine', 'admin'));
$$;
revoke all on function prive.est_cuisine() from public, anon;
grant execute on function prive.est_cuisine() to authenticated;

-- Prévenir toute la cuisine (cuisiniers actifs).
create or replace function prive.notifier_cuisine(p_titre text, p_texte text, p_lien text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (destinataire_id, titre, texte, lien)
  select id, p_titre, p_texte, p_lien from public.profiles where role = 'cuisine' and actif;
$$;
revoke all on function prive.notifier_cuisine(text, text, text) from public, anon, authenticated;

-- ---------- DLC ----------
create table public.dlc_produits (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null check (length(trim(nom)) between 1 and 80),
  ouvert_le  date,
  dlc        date not null,
  photo      text check (photo is null or length(photo) <= 200), -- chemin de la photo dans le stockage « dlc »
  ajoute_par uuid references public.profiles (id) on delete set null default auth.uid(),
  cree_le    timestamptz not null default now(),
  retire_le  timestamptz -- utilisé ou jeté : n'apparaît plus dans la liste
);
create index dlc_produits_dlc_idx on public.dlc_produits (dlc) where retire_le is null;

alter table public.dlc_produits enable row level security;
create policy "dlc_lecture" on public.dlc_produits for select to authenticated using (prive.est_cuisine());
create policy "dlc_ajout" on public.dlc_produits for insert to authenticated with check (prive.est_cuisine());
create policy "dlc_modif" on public.dlc_produits for update to authenticated using (prive.est_cuisine()) with check (prive.est_cuisine());
create policy "dlc_suppr" on public.dlc_produits for delete to authenticated using (prive.est_cuisine());

-- Photos des étiquettes : stockage privé, 5 Mo maximum, images seulement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dlc', 'dlc', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "dlc_photos_lecture" on storage.objects for select to authenticated
  using (bucket_id = 'dlc' and prive.est_cuisine());
create policy "dlc_photos_ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'dlc' and prive.est_cuisine());
create policy "dlc_photos_suppr" on storage.objects for delete to authenticated
  using (bucket_id = 'dlc' and prive.est_cuisine());

-- ---------- Frigos et températures ----------
create table public.frigos (
  id       uuid primary key default gen_random_uuid(),
  nom      text not null unique check (length(trim(nom)) between 1 and 40),
  temp_min numeric(4, 1) not null default 0,
  temp_max numeric(4, 1) not null default 4,
  ordre    integer not null default 0,
  cree_le  timestamptz not null default now(),
  constraint frigo_limites check (temp_min < temp_max)
);
alter table public.frigos enable row level security;
create policy "frigos_lecture" on public.frigos for select to authenticated using (prive.est_cuisine());
create policy "frigos_ajout_admin" on public.frigos for insert to authenticated with check (prive.est_admin());
create policy "frigos_modif_admin" on public.frigos for update to authenticated using (prive.est_admin()) with check (prive.est_admin());
create policy "frigos_suppr_admin" on public.frigos for delete to authenticated using (prive.est_admin());

-- Un relevé par frigo et par jour (corrigeable dans la journée).
create table public.releves_temperature (
  id          uuid primary key default gen_random_uuid(),
  frigo_id    uuid not null references public.frigos (id) on delete cascade,
  jour        date not null default (now() at time zone 'Europe/Paris')::date,
  temperature numeric(4, 1) not null check (temperature between -40 and 40),
  commentaire text check (commentaire is null or length(commentaire) <= 200),
  releve_par  uuid references public.profiles (id) on delete set null default auth.uid(),
  releve_le   timestamptz not null default now(),
  unique (frigo_id, jour)
);
alter table public.releves_temperature enable row level security;
create policy "releves_lecture" on public.releves_temperature for select to authenticated using (prive.est_cuisine());
create policy "releves_ajout" on public.releves_temperature for insert to authenticated with check (prive.est_cuisine());
create policy "releves_modif" on public.releves_temperature for update to authenticated
  using (prive.est_cuisine()) with check (prive.est_cuisine());
create policy "releves_suppr_admin" on public.releves_temperature for delete to authenticated using (prive.est_admin());

-- Qui a relevé et quand ; température hors limites : les admins sont prévenus.
create or replace function prive.controle_releve()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f public.frigos;
begin
  if tg_op = 'UPDATE' then
    new.frigo_id := old.frigo_id;
    new.jour := old.jour;
  end if;
  new.releve_par := coalesce(auth.uid(), new.releve_par);
  new.releve_le := now();
  select * into f from public.frigos where id = new.frigo_id;
  if found and (new.temperature < f.temp_min or new.temperature > f.temp_max)
     and (tg_op = 'INSERT' or new.temperature is distinct from old.temperature) then
    perform prive.notifier_admins('Température hors limites',
      f.nom || ' : ' || replace(to_char(new.temperature, 'FM990.0'), '.', ',') || ' °C (attendu '
        || replace(to_char(f.temp_min, 'FM990.0'), '.', ',') || ' à ' || replace(to_char(f.temp_max, 'FM990.0'), '.', ',') || ' °C)',
      '/cuisine?onglet=temperatures');
  end if;
  return new;
end;
$$;
revoke all on function prive.controle_releve() from public, anon, authenticated;
create trigger avant_releve before insert or update on public.releves_temperature
  for each row execute function prive.controle_releve();

-- ---------- Produits à commander ----------
create table public.commandes (
  id          uuid primary key default gen_random_uuid(),
  produit     text not null check (length(trim(produit)) between 1 and 120),
  quantite    text check (quantite is null or length(quantite) <= 40),
  note        text check (note is null or length(note) <= 200),
  statut      text not null default 'a_commander' check (statut in ('a_commander', 'commande', 'recu')),
  demande_par uuid references public.profiles (id) on delete set null default auth.uid(),
  cree_le     timestamptz not null default now(),
  commande_le timestamptz,
  recu_le     timestamptz
);
create index commandes_statut_idx on public.commandes (statut, cree_le);
alter table public.commandes enable row level security;
create policy "commandes_lecture" on public.commandes for select to authenticated using (prive.est_cuisine());
create policy "commandes_ajout" on public.commandes for insert to authenticated
  with check (prive.est_cuisine() and statut = 'a_commander');
create policy "commandes_suivi_admin" on public.commandes for update to authenticated
  using (prive.est_admin()) with check (prive.est_admin());
create policy "commandes_suppr" on public.commandes for delete to authenticated
  using ((demande_par = auth.uid() and statut = 'a_commander') or prive.est_admin());

create or replace function prive.suivi_commande()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.statut is distinct from old.statut then
    new.commande_le := case when new.statut in ('commande', 'recu') then coalesce(old.commande_le, now()) end;
    new.recu_le := case when new.statut = 'recu' then now() end;
  end if;
  new.demande_par := old.demande_par;
  new.cree_le := old.cree_le;
  return new;
end;
$$;
revoke all on function prive.suivi_commande() from public, anon, authenticated;
create trigger avant_suivi_commande before update on public.commandes
  for each row execute function prive.suivi_commande();

create or replace function prive.notif_commande()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform prive.notifier_admins('À commander', new.produit || coalesce(' (' || new.quantite || ')', '')
    || coalesce(' · ' || prive.nom(new.demande_par), ''), '/cuisine?onglet=commandes');
  return null;
end;
$$;
revoke all on function prive.notif_commande() from public, anon, authenticated;
create trigger notif_commande after insert on public.commandes
  for each row execute function prive.notif_commande();

-- ---------- Rappels automatiques (appelés chaque jour) ----------
-- Matin : produits à utiliser aujourd'hui ou demain (ou déjà dépassés).
create or replace function prive.rappel_dlc()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_depasses integer;
  v_proches integer;
begin
  select count(*) filter (where dlc < v_jour), count(*) filter (where dlc between v_jour and v_jour + 1)
    into v_depasses, v_proches
  from public.dlc_produits where retire_le is null;
  if v_depasses + v_proches > 0 then
    perform prive.notifier_cuisine('DLC à surveiller',
      concat_ws(' · ',
        case when v_proches > 0 then v_proches || ' produit' || case when v_proches > 1 then 's' else '' end || ' à utiliser aujourd''hui ou demain' end,
        case when v_depasses > 0 then v_depasses || ' dépassé' || case when v_depasses > 1 then 's' else '' end end),
      '/cuisine');
  end if;
end;
$$;

-- Après-midi : frigos pas encore relevés aujourd'hui.
create or replace function prive.rappel_temperatures()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_manquants text;
begin
  select string_agg(f.nom, ', ' order by f.ordre, f.nom) into v_manquants
  from public.frigos f
  where not exists (select 1 from public.releves_temperature r where r.frigo_id = f.id and r.jour = v_jour);
  if v_manquants is not null then
    perform prive.notifier_cuisine('Températures à relever', v_manquants, '/cuisine?onglet=temperatures');
  end if;
end;
$$;
revoke all on function prive.rappel_dlc() from public, anon, authenticated;
revoke all on function prive.rappel_temperatures() from public, anon, authenticated;
