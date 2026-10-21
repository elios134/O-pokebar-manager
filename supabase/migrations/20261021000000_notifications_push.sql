-- Collé à la main dans l'éditeur SQL de Supabase le 21/10 (absent de l'historique des migrations en ligne).
-- Notifications sur le téléphone (Web Push).
-- Chaque appareil qui accepte les notifications est enregistré ici ; à chaque nouvelle notification,
-- la base demande à la fonction serveur « envoyer-push » de l'envoyer sur les appareils du destinataire.

create table public.abonnements_push (
  id        uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profiles (id) on delete cascade,
  endpoint  text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh    text not null check (length(p256dh) between 1 and 200),
  auth      text not null check (length(auth) between 1 and 100),
  cree_le   timestamptz not null default now()
);
create index abonnements_push_profil_idx on public.abonnements_push (profil_id);

alter table public.abonnements_push enable row level security;
-- Lecture de ses propres appareils seulement ; les ajouts et retraits passent par les fonctions ci-dessous.
create policy "abonnements_lecture" on public.abonnements_push for select to authenticated
  using (profil_id = auth.uid());

-- Enregistre cet appareil pour la personne connectée (un appareil passé d'un compte à l'autre change de propriétaire).
create or replace function public.enregistrer_abonnement_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and actif) then
    raise exception 'Non connecté.' using errcode = '42501';
  end if;
  delete from public.abonnements_push where endpoint = p_endpoint;
  insert into public.abonnements_push (profil_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end;
$$;

-- Retire cet appareil (notifications désactivées ou déconnexion).
create or replace function public.retirer_abonnement_push(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.abonnements_push where endpoint = p_endpoint and profil_id = auth.uid();
$$;

revoke all on function public.enregistrer_abonnement_push(text, text, text) from public, anon;
revoke all on function public.retirer_abonnement_push(text) from public, anon;
grant execute on function public.enregistrer_abonnement_push(text, text, text) to authenticated;
grant execute on function public.retirer_abonnement_push(text) to authenticated;

-- Appel de la fonction serveur (pg_net, activé dans la migration précédente). L'adresse et la clé partagée sont dans le coffre (Vault) :
-- noms « push_url » et « push_cle ». Un problème d'envoi ne bloque jamais l'enregistrement du planning.

create or replace function prive.envoyer_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_cle text;
begin
  if not exists (select 1 from public.abonnements_push where profil_id = new.destinataire_id) then
    return null;
  end if;
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_url';
    select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'push_cle';
    if v_url is not null and v_cle is not null then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cle-push', v_cle),
        body := jsonb_build_object('id', new.id)
      );
    end if;
  exception when others then
    raise warning 'Notification sur téléphone non envoyée : %', sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function prive.envoyer_push() from public, anon, authenticated;

create trigger envoyer_push after insert on public.notifications
  for each row execute function prive.envoyer_push();
