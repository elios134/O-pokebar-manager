-- Pas de notification pour un compte qui n'existe plus (ex. : horaires supprimés avec leur employé).
create or replace function prive.notifier(p_dest uuid, p_titre text, p_texte text, p_lien text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (destinataire_id, titre, texte, lien)
  select p_dest, p_titre, p_texte, p_lien
  where exists (select 1 from public.profiles where id = p_dest);
$$;
revoke all on function prive.notifier(uuid, text, text, text) from public, anon, authenticated;
