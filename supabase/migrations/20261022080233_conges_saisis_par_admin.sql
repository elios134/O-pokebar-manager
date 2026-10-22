-- L'admin peut saisir lui-même un congé pour un employé (ex. arrêt maladie, congé posé à l'oral).
-- Un congé saisi ainsi est directement accepté ; l'employé est prévenu.
create policy "conges_ajout_admin" on public.conges for insert to authenticated
  with check (prive.est_admin());

-- Congé saisi déjà accepté : on note qui l'a saisi et quand.
create or replace function prive.trace_saisie_conge()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.statut <> 'en_attente' then
    new.traite_le := now();
    new.traite_par := auth.uid();
  end if;
  return new;
end;
$$;
revoke all on function prive.trace_saisie_conge() from public, anon, authenticated;
create trigger avant_saisie_conge before insert on public.conges
  for each row execute function prive.trace_saisie_conge();

-- Notifications : une demande prévient les admins ; un congé saisi par l'admin prévient l'employé.
create or replace function prive.notif_conges()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dates text := 'Du ' || to_char(new.debut, 'DD/MM') || ' au ' || to_char(new.fin, 'DD/MM');
begin
  if tg_op = 'INSERT' and new.statut = 'en_attente' then
    perform prive.notifier_admins('Demande de congé', prive.nom(new.employe_id) || ' : du '
      || to_char(new.debut, 'DD/MM') || ' au ' || to_char(new.fin, 'DD/MM'), '/admin/conges');
  elsif tg_op = 'INSERT' then
    perform prive.notifier(new.employe_id, 'Congé ajouté par votre responsable',
      v_dates || coalesce(' · ' || new.motif, ''), '/mes-conges');
  elsif new.statut is distinct from old.statut and new.statut in ('accepte', 'refuse') then
    perform prive.notifier(new.employe_id,
      case when new.statut = 'accepte' then 'Congé accepté' else 'Congé refusé' end,
      v_dates || coalesce(' · « ' || new.reponse || ' »', ''), '/mes-conges');
  end if;
  return null;
end;
$$;
revoke all on function prive.notif_conges() from public, anon, authenticated;
