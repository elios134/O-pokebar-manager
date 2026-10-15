create table public.profiles (
  id      uuid primary key references auth.users (id) on delete cascade,
  nom     text not null default '',
  prenom  text not null default '',
  role    text not null default 'employe' check (role in ('employe', 'admin')),
  actif   boolean not null default true
);

create table public.shifts (
  id          uuid primary key default gen_random_uuid(),
  employe_id  uuid not null references public.profiles (id) on delete cascade,
  debut       timestamptz not null,
  fin         timestamptz not null,
  note        text,
  cree_le     timestamptz not null default now(),
  constraint fin_apres_debut check (fin > debut)
);

create index shifts_employe_debut_idx on public.shifts (employe_id, debut);

create or replace function public.est_admin()
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

revoke all on function public.est_admin() from public;
grant execute on function public.est_admin() to authenticated;

create or replace function public.creer_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nom, prenom)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nom', ''),
    coalesce(new.raw_user_meta_data ->> 'prenom', '')
  );
  return new;
end;
$$;

create trigger a_la_creation_utilisateur
  after insert on auth.users
  for each row execute function public.creer_profil();

alter table public.profiles enable row level security;

create policy "profiles_lecture"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.est_admin());

create policy "profiles_modif_admin"
  on public.profiles for update
  to authenticated
  using (public.est_admin())
  with check (public.est_admin());

alter table public.shifts enable row level security;

create policy "shifts_lecture"
  on public.shifts for select
  to authenticated
  using (employe_id = auth.uid() or public.est_admin());

create policy "shifts_ajout_admin"
  on public.shifts for insert
  to authenticated
  with check (public.est_admin());

create policy "shifts_modif_admin"
  on public.shifts for update
  to authenticated
  using (public.est_admin())
  with check (public.est_admin());

create policy "shifts_suppr_admin"
  on public.shifts for delete
  to authenticated
  using (public.est_admin());
