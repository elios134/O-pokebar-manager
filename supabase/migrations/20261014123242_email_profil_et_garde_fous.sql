alter table public.profiles add column if not exists email text not null default '';
update public.profiles p set email = coalesce(u.email, '') from auth.users u where u.id = p.id;

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

create or replace function prive.controle_modif_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.email := old.email;
    new.id := old.id;
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

alter policy "shifts_lecture" on public.shifts
  using (
    prive.est_admin()
    or (employe_id = auth.uid()
        and exists (select 1 from public.profiles where id = auth.uid() and actif))
  );
