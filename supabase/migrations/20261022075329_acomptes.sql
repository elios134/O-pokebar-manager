-- Demandes d'acompte sur salaire : même fonctionnement que les congés.
-- L'employé demande un montant ; l'admin accepte ou refuse (avec un message facultatif).
create table public.acomptes (
  id          uuid primary key default gen_random_uuid(),
  employe_id  uuid not null references public.profiles (id) on delete cascade,
  montant     numeric(8, 2) not null check (montant > 0 and montant <= 10000),
  motif       text check (motif is null or length(motif) <= 300),
  statut      text not null default 'en_attente' check (statut in ('en_attente', 'accepte', 'refuse')),
  reponse     text check (reponse is null or length(reponse) <= 300),
  cree_le     timestamptz not null default now(),
  traite_le   timestamptz,
  traite_par  uuid references public.profiles (id) on delete set null
);
create index acomptes_employe_idx on public.acomptes (employe_id, cree_le desc);
-- Une seule demande en attente à la fois par employé.
create unique index acomptes_une_en_attente on public.acomptes (employe_id) where statut = 'en_attente';

alter table public.acomptes enable row level security;

create policy "acomptes_lecture" on public.acomptes for select to authenticated
  using (
    prive.est_admin()
    or (employe_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and actif))
  );

create policy "acomptes_demande" on public.acomptes for insert to authenticated
  with check (
    employe_id = auth.uid()
    and statut = 'en_attente'
    and reponse is null and traite_le is null and traite_par is null
    and exists (select 1 from public.profiles where id = auth.uid() and actif)
  );

-- L'employé retire sa demande tant qu'elle n'est pas traitée.
create policy "acomptes_annulation" on public.acomptes for delete to authenticated
  using ((employe_id = auth.uid() and statut = 'en_attente') or prive.est_admin());

create policy "acomptes_reponse_admin" on public.acomptes for update to authenticated
  using (prive.est_admin()) with check (prive.est_admin());

-- Qui a répondu et quand : rempli automatiquement. La demande elle-même (montant, employé) ne change pas.
create or replace function prive.trace_reponse_acompte()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.statut is distinct from old.statut then
    new.traite_le := case when new.statut = 'en_attente' then null else now() end;
    new.traite_par := case when new.statut = 'en_attente' then null else auth.uid() end;
  end if;
  new.employe_id := old.employe_id;
  new.montant := old.montant;
  new.cree_le := old.cree_le;
  return new;
end;
$$;
revoke all on function prive.trace_reponse_acompte() from public, anon, authenticated;
create trigger avant_reponse_acompte before update on public.acomptes
  for each row execute function prive.trace_reponse_acompte();

-- Notifications (cloche + téléphone).
create or replace function prive.notif_acomptes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_montant text := replace(to_char(new.montant, 'FM999990.00'), '.', ',') || ' €';
begin
  if tg_op = 'INSERT' then
    perform prive.notifier_admins('Demande d''acompte', prive.nom(new.employe_id) || ' : ' || v_montant, '/admin/acomptes');
  elsif new.statut is distinct from old.statut and new.statut in ('accepte', 'refuse') then
    perform prive.notifier(new.employe_id,
      case when new.statut = 'accepte' then 'Acompte accepté' else 'Acompte refusé' end,
      v_montant || coalesce(' · « ' || new.reponse || ' »', ''), '/mes-acomptes');
  end if;
  return null;
end;
$$;
revoke all on function prive.notif_acomptes() from public, anon, authenticated;
create trigger notif_acomptes after insert or update on public.acomptes
  for each row execute function prive.notif_acomptes();
