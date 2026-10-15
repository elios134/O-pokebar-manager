-- Échanges d'horaires retirés de l'application : plus personne ne peut appeler ces fonctions.
revoke execute on function public.collegues() from authenticated;
revoke execute on function public.horaires_collegue(uuid) from authenticated;
revoke execute on function public.mes_echanges() from authenticated;
revoke execute on function public.proposer_echange(uuid, uuid, uuid, text) from authenticated;
revoke execute on function public.repondre_echange(uuid, boolean) from authenticated;
revoke execute on function public.annuler_echange(uuid) from authenticated;
revoke execute on function public.valider_echange(uuid, boolean) from authenticated;
