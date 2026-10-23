-- Fournisseurs (cuisine + admin) et traçabilité des livraisons.

create table public.fournisseurs (
  id        uuid primary key default gen_random_uuid(),
  nom       text not null unique check (length(trim(nom)) between 1 and 80),
  contact   text check (contact is null or length(contact) <= 80),
  telephone text check (telephone is null or length(telephone) <= 30),
  email     text check (email is null or length(email) <= 120),
  livraison text check (livraison is null or length(livraison) <= 120), -- jours et heure limite de commande
  produits  text check (produits is null or length(produits) <= 300),
  note      text check (note is null or length(note) <= 300),
  cree_le   timestamptz not null default now()
);
alter table public.fournisseurs enable row level security;
create policy "fournisseurs_lecture" on public.fournisseurs for select to authenticated using (prive.est_cuisine());
create policy "fournisseurs_ajout" on public.fournisseurs for insert to authenticated with check (prive.est_cuisine());
create policy "fournisseurs_modif" on public.fournisseurs for update to authenticated using (prive.est_cuisine()) with check (prive.est_cuisine());
create policy "fournisseurs_suppr_admin" on public.fournisseurs for delete to authenticated using (prive.est_admin());

-- Un produit à commander peut être rattaché à un fournisseur.
alter table public.commandes add column if not exists fournisseur_id uuid references public.fournisseurs (id) on delete set null;

create table public.livraisons (
  id             uuid primary key default gen_random_uuid(),
  fournisseur_id uuid references public.fournisseurs (id) on delete set null,
  fournisseur    text not null check (length(trim(fournisseur)) between 1 and 80), -- nom gardé pour le registre
  recu_le        timestamptz not null default now(),
  temperature    numeric(4, 1) check (temperature between -40 and 40),
  lot            text check (lot is null or length(lot) <= 60),
  produits       text check (produits is null or length(produits) <= 300),
  conforme       boolean not null default true,
  photo          text check (photo is null or length(photo) <= 200), -- bon de livraison, stockage « dlc »
  recu_par       uuid references public.profiles (id) on delete set null default auth.uid(),
  cree_le        timestamptz not null default now()
);
create index livraisons_recu_idx on public.livraisons (recu_le desc);
alter table public.livraisons enable row level security;
create policy "livraisons_lecture" on public.livraisons for select to authenticated using (prive.est_cuisine());
create policy "livraisons_ajout" on public.livraisons for insert to authenticated with check (prive.est_cuisine());
create policy "livraisons_modif" on public.livraisons for update to authenticated using (prive.est_cuisine()) with check (prive.est_cuisine());
create policy "livraisons_suppr_admin" on public.livraisons for delete to authenticated using (prive.est_admin());

create or replace function prive.controle_livraison()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.fournisseur_id is not null and (tg_op = 'INSERT' or new.fournisseur_id is distinct from old.fournisseur_id) then
    select nom into new.fournisseur from public.fournisseurs where id = new.fournisseur_id;
  end if;
  if tg_op = 'INSERT' then
    new.recu_par := coalesce(auth.uid(), new.recu_par);
    new.cree_le := now();
  else
    new.recu_par := old.recu_par;
    new.cree_le := old.cree_le;
  end if;
  return new;
end;
$$;
revoke all on function prive.controle_livraison() from public, anon, authenticated;
create trigger avant_livraison before insert or update on public.livraisons
  for each row execute function prive.controle_livraison();

-- Livraison non conforme : les admins sont prévenus.
create or replace function prive.notif_livraison()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.conforme and (tg_op = 'INSERT' or old.conforme) then
    perform prive.notifier_admins('Livraison non conforme', new.fournisseur
      || coalesce(' · ' || replace(to_char(new.temperature, 'FM990.0'), '.', ',') || ' °C', '')
      || coalesce(' · ' || new.produits, ''), '/cuisine?onglet=livraisons');
  end if;
  return null;
end;
$$;
revoke all on function prive.notif_livraison() from public, anon, authenticated;
create trigger notif_livraison after insert or update on public.livraisons
  for each row execute function prive.notif_livraison();
