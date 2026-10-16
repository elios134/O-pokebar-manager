-- Vue « par employé » : heures prévues au contrat et semaine type de chaque employé.
-- semaine_type : 7 jours (lundi → dimanche), chacun une liste de créneaux comme les horaires types
-- (liste vide = repos). Modifiable par l'admin seulement (règles déjà en place sur profiles).
alter table public.profiles
  add column if not exists heures_contrat numeric(4, 1)
    check (heures_contrat is null or (heures_contrat > 0 and heures_contrat <= 60)),
  add column if not exists semaine_type jsonb
    check (semaine_type is null or (jsonb_typeof(semaine_type) = 'array' and jsonb_array_length(semaine_type) = 7));
