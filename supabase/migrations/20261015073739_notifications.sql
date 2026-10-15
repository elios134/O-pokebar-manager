create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  destinataire_id uuid not null references public.profiles (id) on delete cascade,
  titre           text not null,
  texte           text,
  lien            text,
  lue             boolean not null default false,
  cree_le         timestamptz not null default now()
);
create index notifications_destinataire_idx on public.notifications (destinataire_id, cree_le desc);

alter table public.notifications enable row level security;
create policy "notifications_lecture" on public.notifications for select to authenticated
  using (destinataire_id = auth.uid());
create policy "notifications_marquer_lue" on public.notifications for update to authenticated
  using (destinataire_id = auth.uid()) with check (destinataire_id = auth.uid());
-- Seule la colonne « lue » peut être modifiée depuis le site.
revoke update on public.notifications from authenticated, anon;
grant update (lue) on public.notifications to authenticated;

-- ---------- Outils ----------
create or replace function prive.texte_horaire(d timestamptz, f timestamptz)
returns text language sql immutable as $$
  select 'le ' || to_char(d at time zone 'Europe/Paris', 'DD/MM') || ' de '
         || to_char(d at time zone 'Europe/Paris', 'HH24:MI') || ' à '
         || to_char(f at time zone 'Europe/Paris', 'HH24:MI');
$$;

create or replace function prive.notifier(p_dest uuid, p_titre text, p_texte text, p_lien text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (destinataire_id, titre, texte, lien) values (p_dest, p_titre, p_texte, p_lien);
$$;

create or replace function prive.notifier_admins(p_titre text, p_texte text, p_lien text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (destinataire_id, titre, texte, lien)
  select id, p_titre, p_texte, p_lien from public.profiles where role = 'admin' and actif;
$$;

create or replace function prive.nom(p uuid)
returns text language sql stable security definer set search_path = public as $$
  select prenom || ' ' || nom from public.profiles where id = p;
$$;

revoke all on function prive.texte_horaire(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function prive.notifier(uuid, text, text, text) from public, anon, authenticated;
revoke all on function prive.notifier_admins(text, text, text) from public, anon, authenticated;
revoke all on function prive.nom(uuid) from public, anon, authenticated;

-- ---------- Horaires ----------
-- Ajouts groupés : un seul message par employé (ex. planification de plusieurs jours).
create or replace function prive.notif_horaires_ajoutes()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select employe_id, count(*) n, min(debut) d, min(fin) f from nouveaux group by employe_id loop
    if r.n = 1 then
      perform prive.notifier(r.employe_id, 'Nouvel horaire', prive.texte_horaire(r.d, r.f), '/mon-planning');
    else
      perform prive.notifier(r.employe_id, r.n || ' nouveaux horaires',
        'À partir du ' || to_char(r.d at time zone 'Europe/Paris', 'DD/MM'), '/mon-planning');
    end if;
  end loop;
  return null;
end;
$$;
create trigger notif_horaires_ajoutes after insert on public.shifts
  referencing new table as nouveaux for each statement execute function prive.notif_horaires_ajoutes();

create or replace function prive.notif_horaire_modifie()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.employe_id <> old.employe_id then
    perform prive.notifier(old.employe_id, 'Horaire retiré', prive.texte_horaire(old.debut, old.fin), '/mon-planning');
    perform prive.notifier(new.employe_id, 'Horaire ajouté', prive.texte_horaire(new.debut, new.fin), '/mon-planning');
  elsif new.debut <> old.debut or new.fin <> old.fin
        or new.pause_debut is distinct from old.pause_debut or new.pause_fin is distinct from old.pause_fin then
    perform prive.notifier(new.employe_id, 'Horaire modifié', 'Maintenant ' || prive.texte_horaire(new.debut, new.fin), '/mon-planning');
  end if;
  return null;
end;
$$;
create trigger notif_horaire_modifie after update on public.shifts
  for each row execute function prive.notif_horaire_modifie();

create or replace function prive.notif_horaire_supprime()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.fin > now() then
    perform prive.notifier(old.employe_id, 'Horaire supprimé', prive.texte_horaire(old.debut, old.fin), '/mon-planning');
  end if;
  return null;
end;
$$;
create trigger notif_horaire_supprime after delete on public.shifts
  for each row execute function prive.notif_horaire_supprime();

-- ---------- Congés ----------
create or replace function prive.notif_conges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform prive.notifier_admins('Demande de congé', prive.nom(new.employe_id) || ' : du '
      || to_char(new.debut, 'DD/MM') || ' au ' || to_char(new.fin, 'DD/MM'), '/admin/conges');
  elsif new.statut is distinct from old.statut and new.statut in ('accepte', 'refuse') then
    perform prive.notifier(new.employe_id,
      case when new.statut = 'accepte' then 'Congé accepté' else 'Congé refusé' end,
      'Du ' || to_char(new.debut, 'DD/MM') || ' au ' || to_char(new.fin, 'DD/MM')
        || coalesce(' · « ' || new.reponse || ' »', ''), '/mes-conges');
  end if;
  return null;
end;
$$;
create trigger notif_conges after insert or update on public.conges
  for each row execute function prive.notif_conges();

-- ---------- Échanges ----------
create or replace function prive.notif_echanges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform prive.notifier(new.destinataire_id, 'Proposition d''échange',
      prive.nom(new.demandeur_id) || ' vous propose un échange d''horaire.', '/echanges');
  elsif new.statut is distinct from old.statut then
    case new.statut
      when 'attente_admin' then
        perform prive.notifier(new.demandeur_id, 'Échange accepté par ' || prive.nom(new.destinataire_id),
          'Il reste la validation du responsable.', '/echanges');
        perform prive.notifier_admins('Échange à valider',
          prive.nom(new.demandeur_id) || ' et ' || prive.nom(new.destinataire_id), '/admin/echanges');
      when 'refuse_collegue' then
        perform prive.notifier(new.demandeur_id, 'Échange refusé',
          prive.nom(new.destinataire_id) || ' a refusé votre proposition.', '/echanges');
      when 'accepte' then
        perform prive.notifier(new.demandeur_id, 'Échange validé', 'Votre planning est à jour.', '/mon-planning');
        perform prive.notifier(new.destinataire_id, 'Échange validé', 'Votre planning est à jour.', '/mon-planning');
      when 'refuse' then
        perform prive.notifier(new.demandeur_id, 'Échange refusé par le responsable', null, '/echanges');
        perform prive.notifier(new.destinataire_id, 'Échange refusé par le responsable', null, '/echanges');
      when 'annule' then
        perform prive.notifier(new.destinataire_id, 'Échange annulé',
          prive.nom(new.demandeur_id) || ' a annulé sa proposition.', '/echanges');
      else null;
    end case;
  end if;
  return null;
end;
$$;
create trigger notif_echanges after insert or update on public.echanges
  for each row execute function prive.notif_echanges();

revoke all on function prive.notif_horaires_ajoutes() from public, anon, authenticated;
revoke all on function prive.notif_horaire_modifie() from public, anon, authenticated;
revoke all on function prive.notif_horaire_supprime() from public, anon, authenticated;
revoke all on function prive.notif_conges() from public, anon, authenticated;
revoke all on function prive.notif_echanges() from public, anon, authenticated;
