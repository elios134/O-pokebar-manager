-- Vérifications de la base. Chaque test s'arrête net avec un message clair s'il échoue.
\set QUIET on
\o /dev/null
set client_min_messages = warning;

-- ---------- Outils de test ----------
create schema test;
grant usage on schema test to authenticated, anon;

create function test.verifier(ok boolean, quoi text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'ÉCHEC : %', quoi; end if;
  raise notice 'ok  %', quoi;
end $$;

-- La commande doit être refusée (erreur ou aucune ligne touchée).
create function test.refuse(commande text, quoi text) returns void language plpgsql as $$
declare n bigint;
begin
  execute commande;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'ÉCHEC (accepté alors qu''il devait être refusé) : %', quoi; end if;
  raise notice 'ok  %', quoi;
exception
  when raise_exception then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    raise notice 'ok  %', quoi;
  when others then
    raise notice 'ok  %', quoi;
end $$;

-- Se mettre à la place de quelqu'un (null = personne de connecté, en tant que « anon »).
create function test.connecte(qui uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(qui::text, ''), false);
end $$;

grant execute on all functions in schema test to authenticated, anon;
set client_min_messages = notice;

-- ---------- Données ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.fr', '{"prenom":"Ada","nom":"Admin"}'),
  ('00000000-0000-0000-0000-000000000001', 'lea@test.fr',   '{"prenom":"Léa","nom":"Martin"}'),
  ('00000000-0000-0000-0000-000000000002', 'tom@test.fr',   '{"prenom":"Tom","nom":"Petit"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

select test.verifier((select count(*) = 3 from public.profiles), 'un profil est créé pour chaque compte');
select test.verifier((select email = 'lea@test.fr' and prenom = 'Léa' from public.profiles
  where id = '00000000-0000-0000-0000-000000000001'), 'le profil reprend email, prénom et nom');

-- ---------- Personne de connecté ----------
set role anon;
select test.connecte(null);
select test.refuse('select * from public.profiles', 'un visiteur non connecté ne lit pas les profils');
select test.refuse('select * from public.shifts', 'un visiteur non connecté ne lit pas les horaires');
reset role;

-- ---------- Admin ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
insert into public.equipes (nom) values ('Cuisine');
update public.profiles set equipe_id = (select id from public.equipes)
  where id = '00000000-0000-0000-0000-000000000001';
select test.verifier((select equipe_id is not null from public.profiles
  where id = '00000000-0000-0000-0000-000000000001'), 'l''admin range un employé dans une équipe');

insert into public.shifts (employe_id, debut, fin, pause_debut, pause_fin) values
  ('00000000-0000-0000-0000-000000000001', now() + interval '1 day', now() + interval '1 day 8 hours',
   now() + interval '1 day 3 hours', now() + interval '1 day 3 hours 30 minutes'),
  ('00000000-0000-0000-0000-000000000002', now() + interval '1 day', now() + interval '1 day 6 hours', null, null);
select test.verifier((select pause_minutes = 30 from public.shifts
  where employe_id = '00000000-0000-0000-0000-000000000001'), 'la durée de pause est calculée toute seule');
select test.verifier((select pause_minutes = 0 from public.shifts
  where employe_id = '00000000-0000-0000-0000-000000000002'), 'un horaire sans pause est accepté');
select test.refuse($$insert into public.shifts (employe_id, debut, fin) values
  ('00000000-0000-0000-0000-000000000001', now(), now() - interval '1 hour')$$, 'un horaire qui finit avant de commencer est refusé');
select test.refuse($$insert into public.shifts (employe_id, debut, fin, pause_debut, pause_fin) values
  ('00000000-0000-0000-0000-000000000001', now(), now() + interval '2 hours', now() + interval '3 hours', now() + interval '4 hours')$$,
  'une pause en dehors du service est refusée');
select test.refuse($$update public.profiles set role = 'employe' where id = '00000000-0000-0000-0000-00000000000a'$$,
  'l''admin ne peut pas se retirer son propre rôle');
select test.refuse($$update public.profiles set actif = false where id = '00000000-0000-0000-0000-00000000000a'$$,
  'l''admin ne peut pas se désactiver lui-même');
update public.profiles set email = 'pirate@test.fr' where id = '00000000-0000-0000-0000-000000000001';
select test.verifier((select email = 'lea@test.fr' from public.profiles
  where id = '00000000-0000-0000-0000-000000000001'), 'l''email du profil ne se change pas depuis le site');
reset role;

-- ---------- Employé ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000001');
select test.verifier((select count(*) = 1 from public.profiles), 'un employé ne voit que son propre profil');
select test.verifier((select count(*) = 1 from public.shifts), 'un employé ne voit que ses propres horaires');
select test.verifier((select count(*) >= 1 from public.notifications where titre = 'Nouvel horaire'),
  'l''employé reçoit une notification pour son nouvel horaire');
select test.refuse($$insert into public.shifts (employe_id, debut, fin) values
  ('00000000-0000-0000-0000-000000000001', now(), now() + interval '1 hour')$$, 'un employé ne crée pas d''horaire');
select test.refuse('update public.shifts set fin = fin + interval ''1 hour''', 'un employé ne modifie pas ses horaires');
select test.refuse('delete from public.shifts', 'un employé ne supprime pas d''horaire');
select test.refuse($$update public.profiles set role = 'admin'$$, 'un employé ne se donne pas le rôle admin');
select test.refuse($$insert into public.equipes (nom) values ('Pirates')$$, 'un employé ne crée pas d''équipe');
select test.refuse('update public.notifications set titre = ''faux''', 'seule la case « lue » d''une notification se modifie');
update public.notifications set lue = true;
select test.verifier((select bool_and(lue) from public.notifications), 'un employé marque ses notifications comme lues');

-- Congés
insert into public.conges (employe_id, debut, fin, motif)
  values ('00000000-0000-0000-0000-000000000001', current_date + 10, current_date + 12, 'Vacances');
select test.refuse($$insert into public.conges (employe_id, debut, fin)
  values ('00000000-0000-0000-0000-000000000002', current_date + 10, current_date + 12)$$, 'un employé ne demande pas de congé pour un autre');
select test.refuse($$insert into public.conges (employe_id, debut, fin, statut)
  values ('00000000-0000-0000-0000-000000000001', current_date + 20, current_date + 21, 'accepte')$$, 'un employé ne s''accorde pas un congé');
select test.refuse($$update public.conges set statut = 'accepte'$$, 'un employé ne valide pas sa propre demande');

-- Échanges d'horaires désactivés
select test.refuse('select * from public.collegues()', 'les échanges d''horaires ne sont plus utilisables');
reset role;

-- ---------- Réponse de l'admin aux congés ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
select test.verifier((select count(*) = 1 from public.notifications where titre = 'Demande de congé'),
  'l''admin est prévenu d''une demande de congé');
update public.conges set statut = 'accepte', reponse = 'Bonnes vacances';
select test.verifier((select traite_par = '00000000-0000-0000-0000-00000000000a' and traite_le is not null
  from public.conges), 'la réponse garde qui a répondu et quand');
reset role;
select test.verifier((select count(*) = 1 from public.notifications
  where destinataire_id = '00000000-0000-0000-0000-000000000001' and titre = 'Congé accepté'),
  'l''employé est prévenu que son congé est accepté');

set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000001');
select test.refuse('delete from public.conges', 'un employé ne retire pas un congé déjà accepté');
reset role;

-- ---------- Compte désactivé ----------
update public.profiles set actif = false where id = '00000000-0000-0000-0000-000000000002';
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000002');
select test.verifier((select count(*) = 0 from public.shifts), 'un compte désactivé ne voit plus ses horaires');
select test.refuse($$insert into public.conges (employe_id, debut, fin)
  values ('00000000-0000-0000-0000-000000000002', current_date + 1, current_date + 1)$$, 'un compte désactivé ne demande pas de congé');
reset role;

-- ---------- Suppression d'un compte ----------
delete from auth.users where id = '00000000-0000-0000-0000-000000000001';
select test.verifier((select count(*) = 0 from public.profiles where id = '00000000-0000-0000-0000-000000000001')
  and (select count(*) = 0 from public.shifts where employe_id = '00000000-0000-0000-0000-000000000001')
  and (select count(*) = 0 from public.conges where employe_id = '00000000-0000-0000-0000-000000000001'),
  'supprimer un compte efface son profil, ses horaires et ses congés');

\o
\echo 'Tous les tests de la base sont passés.'
