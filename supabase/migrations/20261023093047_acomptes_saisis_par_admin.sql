-- L'admin peut saisir lui-même un acompte pour un employé (ex. avance donnée de la main à la main).
-- Un acompte saisi ainsi est directement accepté ; l'employé est prévenu.
create policy "acomptes_ajout_admin" on public.acomptes for insert to authenticated
  with check (prive.est_admin());

-- Acompte saisi déjà accepté : on note qui l'a saisi et quand.
create or replace function prive.trace_saisie_acompte()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.statut <> 'en_attente' then
    new.traite_le := now();
    new.traite_par := auth.uid();
  end if;
  return new;
end;
$$;
revoke all on function prive.trace_saisie_acompte() from public, anon, authenticated;
create trigger avant_saisie_acompte before insert on public.acomptes
  for each row execute function prive.trace_saisie_acompte();

-- Notifications : une demande prévient les admins ; un acompte saisi par l'admin prévient l'employé.
create or replace function prive.notif_acomptes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_montant text := replace(to_char(new.montant, 'FM999990.00'), '.', ',') || ' €';
begin
  if tg_op = 'INSERT' and new.statut = 'en_attente' then
    perform prive.notifier_admins('Demande d''acompte', prive.nom(new.employe_id) || ' : ' || v_montant, '/admin/acomptes');
  elsif tg_op = 'INSERT' then
    perform prive.notifier(new.employe_id, 'Acompte ajouté par votre responsable',
      v_montant || coalesce(' · ' || new.motif, ''), '/mes-acomptes');
  elsif new.statut is distinct from old.statut and new.statut in ('accepte', 'refuse') then
    perform prive.notifier(new.employe_id,
      case when new.statut = 'accepte' then 'Acompte accepté' else 'Acompte refusé' end,
      v_montant || coalesce(' · « ' || new.reponse || ' »', ''), '/mes-acomptes');
  end if;
  return null;
end;
$$;
revoke all on function prive.notif_acomptes() from public, anon, authenticated;
