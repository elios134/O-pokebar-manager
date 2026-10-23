-- Arrêts maladie : l'employé déclare son arrêt (avec la photo de l'arrêt de travail, tout de suite
-- ou plus tard). Pas d'acceptation : l'admin coche « arrêt reçu ». L'admin peut aussi en saisir un.

-- Le compte connecté est-il actif ?
create or replace function prive.moi_actif()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and actif);
$$;
revoke all on function prive.moi_actif() from public, anon;
grant execute on function prive.moi_actif() to authenticated;

create table public.arrets_maladie (
  id         uuid primary key default gen_random_uuid(),
  employe_id uuid not null references public.profiles (id) on delete cascade,
  debut      date not null,
  fin        date not null,
  message    text check (message is null or length(message) <= 300),
  photo      text check (photo is null or length(photo) <= 200), -- chemin dans le stockage « arrets »
  recu_le    timestamptz, -- arrêt de travail reçu par l'admin
  recu_par   uuid references public.profiles (id) on delete set null,
  saisi_par  uuid references public.profiles (id) on delete set null default auth.uid(),
  cree_le    timestamptz not null default now(),
  constraint arret_fin_apres_debut check (fin >= debut),
  constraint arret_duree check (fin - debut <= 366)
);
create index arrets_maladie_employe_idx on public.arrets_maladie (employe_id, debut);

alter table public.arrets_maladie enable row level security;
create policy "arrets_lecture" on public.arrets_maladie for select to authenticated
  using (prive.est_admin() or (employe_id = auth.uid() and prive.moi_actif()));
create policy "arrets_declaration" on public.arrets_maladie for insert to authenticated
  with check (prive.est_admin() or (employe_id = auth.uid() and prive.moi_actif() and recu_le is null));
-- L'employé peut seulement ajouter ou changer la photo de son arrêt (voir le trigger) ; l'admin modifie tout.
create policy "arrets_modif" on public.arrets_maladie for update to authenticated
  using (prive.est_admin() or (employe_id = auth.uid() and prive.moi_actif()))
  with check (prive.est_admin() or (employe_id = auth.uid() and prive.moi_actif()));
create policy "arrets_suppr" on public.arrets_maladie for delete to authenticated
  using (prive.est_admin() or (employe_id = auth.uid() and recu_le is null));

create or replace function prive.controle_arret()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean := prive.est_admin();
begin
  if tg_op = 'INSERT' then
    new.saisi_par := coalesce(auth.uid(), new.saisi_par);
    new.cree_le := now();
    if v_admin and new.recu_le is not null then new.recu_par := auth.uid(); else new.recu_par := null; end if;
    if not v_admin then new.recu_le := null; end if;
    return new;
  end if;
  new.employe_id := old.employe_id;
  new.saisi_par := old.saisi_par;
  new.cree_le := old.cree_le;
  if not v_admin then
    -- l'employé ne touche qu'à la photo
    new.debut := old.debut; new.fin := old.fin; new.message := old.message;
    new.recu_le := old.recu_le; new.recu_par := old.recu_par;
  elsif new.recu_le is distinct from old.recu_le then
    new.recu_par := case when new.recu_le is null then null else auth.uid() end;
  end if;
  return new;
end;
$$;
revoke all on function prive.controle_arret() from public, anon, authenticated;
create trigger avant_arret before insert or update on public.arrets_maladie
  for each row execute function prive.controle_arret();

create or replace function prive.notif_arret()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dates text := 'du ' || to_char(new.debut, 'DD/MM') || ' au ' || to_char(new.fin, 'DD/MM');
begin
  if tg_op = 'INSERT' and new.saisi_par is distinct from new.employe_id then
    perform prive.notifier(new.employe_id, 'Arrêt maladie enregistré par votre responsable', 'D' || substr(v_dates, 2), '/mes-conges?onglet=maladie');
  elsif tg_op = 'INSERT' then
    perform prive.notifier_admins('Arrêt maladie', prive.nom(new.employe_id) || ' : ' || v_dates
      || case when new.photo is null then ' (arrêt de travail à venir)' else '' end, '/admin/conges?onglet=maladie');
  elsif new.photo is not null and old.photo is null and not prive.est_admin() then
    perform prive.notifier_admins('Arrêt de travail ajouté', prive.nom(new.employe_id) || ' : ' || v_dates, '/admin/conges?onglet=maladie');
  end if;
  return null;
end;
$$;
revoke all on function prive.notif_arret() from public, anon, authenticated;
create trigger notif_arret after insert or update on public.arrets_maladie
  for each row execute function prive.notif_arret();

-- Photos / PDF des arrêts : un dossier par employé (« <id employé>/… »), visible par lui et l'admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('arrets', 'arrets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "arrets_fichiers_lecture" on storage.objects for select to authenticated
  using (bucket_id = 'arrets' and (prive.est_admin() or ((storage.foldername(name))[1] = auth.uid()::text and prive.moi_actif())));
create policy "arrets_fichiers_ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'arrets' and (prive.est_admin() or ((storage.foldername(name))[1] = auth.uid()::text and prive.moi_actif())));
create policy "arrets_fichiers_suppr" on storage.objects for delete to authenticated
  using (bucket_id = 'arrets' and (prive.est_admin() or (storage.foldername(name))[1] = auth.uid()::text));
