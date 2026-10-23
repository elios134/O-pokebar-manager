-- Documents des employés (fiches de paie, contrats…) : l'admin dépose un fichier pour un employé,
-- qui ne voit que les siens et reçoit une notification.

create table public.documents (
  id         uuid primary key default gen_random_uuid(),
  employe_id uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type in ('paie', 'contrat', 'autre')),
  titre      text not null check (length(trim(titre)) between 1 and 120),
  mois       date, -- 1er du mois concerné (fiche de paie)
  chemin     text not null check (length(chemin) <= 200), -- dans le stockage « documents »
  taille     integer check (taille between 0 and 10485760),
  cree_par   uuid references public.profiles (id) on delete set null default auth.uid(),
  cree_le    timestamptz not null default now(),
  vu_le      timestamptz -- première ouverture par l'employé
);
create index documents_employe_idx on public.documents (employe_id, cree_le desc);

alter table public.documents enable row level security;
create policy "documents_lecture" on public.documents for select to authenticated
  using (prive.est_admin() or (employe_id = auth.uid() and prive.moi_actif()));
create policy "documents_ajout_admin" on public.documents for insert to authenticated
  with check (prive.est_admin());
create policy "documents_modif_admin" on public.documents for update to authenticated
  using (prive.est_admin()) with check (prive.est_admin());
create policy "documents_suppr_admin" on public.documents for delete to authenticated
  using (prive.est_admin());

create or replace function prive.trace_document()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.cree_par := coalesce(auth.uid(), new.cree_par);
  new.cree_le := now();
  new.vu_le := null;
  return new;
end;
$$;
revoke all on function prive.trace_document() from public, anon, authenticated;
create trigger avant_document before insert on public.documents
  for each row execute function prive.trace_document();

create or replace function prive.notif_document()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform prive.notifier(new.employe_id, 'Nouveau document', new.titre, '/mes-documents');
  return null;
end;
$$;
revoke all on function prive.notif_document() from public, anon, authenticated;
create trigger notif_document after insert on public.documents
  for each row execute function prive.notif_document();

-- L'employé note qu'il a ouvert son document (la première fois seulement).
create or replace function public.document_vu(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.documents set vu_le = now()
  where id = p_id and employe_id = auth.uid() and vu_le is null and prive.moi_actif();
$$;
revoke all on function public.document_vu(uuid) from public, anon;
grant execute on function public.document_vu(uuid) to authenticated;

-- Fichiers : un dossier par employé (« <id employé>/… ») ; l'admin dépose, l'employé lit les siens.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "documents_fichiers_lecture" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (prive.est_admin() or ((storage.foldername(name))[1] = auth.uid()::text and prive.moi_actif())));
create policy "documents_fichiers_ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and prive.est_admin());
create policy "documents_fichiers_suppr" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and prive.est_admin());
