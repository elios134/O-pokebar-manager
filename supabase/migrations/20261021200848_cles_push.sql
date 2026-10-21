-- Clés d'envoi des notifications (gardées dans le coffre), lisibles seulement par la fonction serveur.
-- Les valeurs sont mises dans le coffre à part (noms : push_url, push_cle, push_vapid_publique,
-- push_vapid_privee) et ne sont jamais dans le code.
create or replace function public.cles_push()
returns table (cle text, vapid_publique text, vapid_privee text)
language sql stable security definer set search_path = public as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_cle'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_publique'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_privee');
$$;
revoke all on function public.cles_push() from public, anon, authenticated;
grant execute on function public.cles_push() to service_role;
