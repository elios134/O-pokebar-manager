-- Plus de fiches de paie dans l'app : les documents sont seulement des contrats ou « autres ».
-- (Aucun document n'était enregistré au moment du changement.)
alter table public.documents drop constraint if exists documents_type_check;
alter table public.documents add constraint documents_type_check check (type in ('contrat', 'autre'));
alter table public.documents drop column if exists mois;
comment on table public.documents is 'Documents des employés (contrats, autres) déposés par l''admin.';
