-- Chacun peut effacer ses propres notifications (bouton « Tout effacer » de la cloche).
create policy "notifications_effacer" on public.notifications for delete to authenticated
  using (destinataire_id = auth.uid());
grant delete on public.notifications to authenticated;
